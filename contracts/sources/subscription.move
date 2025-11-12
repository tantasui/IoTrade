module iot_data_marketplace::subscription {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use std::string::String;
    use iot_data_marketplace::data_marketplace::{Self, DataFeed, DataFeedRegistry};

    // =================== Structs ===================

    /// Represents a subscription tier
    public struct SubscriptionTier has copy, drop, store {
        name: String,
        query_limit: u64, // 0 = unlimited
        duration_days: u64,
    }

    /// Represents an active subscription
    public struct Subscription has key, store {
        id: UID,
        consumer: address,
        feed_id: ID,
        tier: u8, // 0 = pay-per-query, 1 = monthly, 2 = premium
        start_epoch: u64,
        expiry_epoch: u64,
        payment_amount: u64,
        queries_used: u64,
        is_active: bool,
    }

    /// Platform treasury to collect fees
    public struct PlatformTreasury has key {
        id: UID,
        balance: Balance<SUI>,
        total_collected: u64,
    }

    // =================== Events ===================

    public struct SubscriptionCreated has copy, drop {
        subscription_id: ID,
        consumer: address,
        feed_id: ID,
        tier: u8,
        payment_amount: u64,
        expiry_epoch: u64,
    }

    public struct QueryExecuted has copy, drop {
        subscription_id: ID,
        consumer: address,
        feed_id: ID,
        timestamp: u64,
    }

    public struct SubscriptionRenewed has copy, drop {
        subscription_id: ID,
        consumer: address,
        new_expiry_epoch: u64,
        payment_amount: u64,
    }

    public struct SubscriptionCancelled has copy, drop {
        subscription_id: ID,
        consumer: address,
    }

    // =================== Errors ===================

    const EInsufficientPayment: u64 = 1;
    const ESubscriptionExpired: u64 = 2;
    const ESubscriptionInactive: u64 = 3;
    const ENotSubscriber: u64 = 4;
    const EFeedInactive: u64 = 5;
    const EQueryLimitExceeded: u64 = 6;

    // =================== Constants ===================

    const TIER_PAY_PER_QUERY: u8 = 0;
    const TIER_MONTHLY: u8 = 1;
    const TIER_PREMIUM: u8 = 2;

    const SECONDS_PER_DAY: u64 = 86400;
    const MONTHLY_DURATION_DAYS: u64 = 30;

    // =================== Initialization ===================

    fun init(ctx: &mut TxContext) {
        let treasury = PlatformTreasury {
            id: object::new(ctx),
            balance: balance::zero(),
            total_collected: 0,
        };
        transfer::share_object(treasury);
    }

    // =================== Public Functions ===================

    /// Subscribe to a data feed with monthly subscription
    public entry fun subscribe_to_feed(
        feed: &mut DataFeed,
        registry: &DataFeedRegistry,
        treasury: &mut PlatformTreasury,
        payment: Coin<SUI>,
        tier: u8,
        ctx: &mut TxContext
    ) {
        assert!(data_marketplace::is_active(feed), EFeedInactive);

        let payment_amount = coin::value(&payment);
        let required_amount = if (tier == TIER_MONTHLY) {
            data_marketplace::get_monthly_subscription_price(feed)
        } else {
            data_marketplace::get_price_per_query(feed)
        };

        assert!(payment_amount >= required_amount, EInsufficientPayment);

        // Calculate platform fee and provider payment
        let platform_fee_percentage = data_marketplace::get_platform_fee_percentage(registry);
        let platform_fee = (payment_amount * platform_fee_percentage) / 10000;
        let provider_payment = payment_amount - platform_fee;

        // Split payment
        let payment_balance = coin::into_balance(payment);
        let platform_fee_balance = balance::split(&mut payment_balance, platform_fee);

        // Add to platform treasury
        balance::join(&mut treasury.balance, platform_fee_balance);
        treasury.total_collected = treasury.total_collected + platform_fee;

        // Transfer provider payment
        let provider_coin = coin::from_balance(payment_balance, ctx);
        transfer::public_transfer(provider_coin, data_marketplace::get_provider(feed));

        // Update feed stats
        data_marketplace::increment_subscribers(feed);
        data_marketplace::add_revenue(feed, provider_payment);

        // Calculate expiry
        let current_epoch = tx_context::epoch(ctx);
        let expiry_epoch = if (tier == TIER_MONTHLY || tier == TIER_PREMIUM) {
            current_epoch + MONTHLY_DURATION_DAYS
        } else {
            current_epoch + 1 // Pay-per-query expires after 1 epoch
        };

        // Create subscription
        let subscription = Subscription {
            id: object::new(ctx),
            consumer: tx_context::sender(ctx),
            feed_id: object::id(feed),
            tier,
            start_epoch: current_epoch,
            expiry_epoch,
            payment_amount,
            queries_used: 0,
            is_active: true,
        };

        let subscription_id = object::id(&subscription);

        event::emit(SubscriptionCreated {
            subscription_id,
            consumer: tx_context::sender(ctx),
            feed_id: object::id(feed),
            tier,
            payment_amount,
            expiry_epoch,
        });

        transfer::share_object(subscription);
    }

    /// Execute a query (for pay-per-query model)
    public entry fun execute_query(
        subscription: &mut Subscription,
        ctx: &mut TxContext
    ) {
        assert!(subscription.consumer == tx_context::sender(ctx), ENotSubscriber);
        assert!(subscription.is_active, ESubscriptionInactive);
        assert!(tx_context::epoch(ctx) <= subscription.expiry_epoch, ESubscriptionExpired);

        subscription.queries_used = subscription.queries_used + 1;

        event::emit(QueryExecuted {
            subscription_id: object::id(subscription),
            consumer: tx_context::sender(ctx),
            feed_id: subscription.feed_id,
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Renew a subscription
    public entry fun renew_subscription(
        subscription: &mut Subscription,
        feed: &mut DataFeed,
        registry: &DataFeedRegistry,
        treasury: &mut PlatformTreasury,
        payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        assert!(subscription.consumer == tx_context::sender(ctx), ENotSubscriber);
        assert!(data_marketplace::is_active(feed), EFeedInactive);

        let payment_amount = coin::value(&payment);
        let required_amount = if (subscription.tier == TIER_MONTHLY) {
            data_marketplace::get_monthly_subscription_price(feed)
        } else {
            data_marketplace::get_price_per_query(feed)
        };

        assert!(payment_amount >= required_amount, EInsufficientPayment);

        // Calculate platform fee and provider payment
        let platform_fee_percentage = data_marketplace::get_platform_fee_percentage(registry);
        let platform_fee = (payment_amount * platform_fee_percentage) / 10000;
        let provider_payment = payment_amount - platform_fee;

        // Split payment
        let payment_balance = coin::into_balance(payment);
        let platform_fee_balance = balance::split(&mut payment_balance, platform_fee);

        // Add to platform treasury
        balance::join(&mut treasury.balance, platform_fee_balance);
        treasury.total_collected = treasury.total_collected + platform_fee;

        // Transfer provider payment
        let provider_coin = coin::from_balance(payment_balance, ctx);
        transfer::public_transfer(provider_coin, data_marketplace::get_provider(feed));

        // Update feed revenue
        data_marketplace::add_revenue(feed, provider_payment);

        // Extend subscription
        let current_epoch = tx_context::epoch(ctx);
        let new_expiry = if (subscription.tier == TIER_MONTHLY || subscription.tier == TIER_PREMIUM) {
            current_epoch + MONTHLY_DURATION_DAYS
        } else {
            current_epoch + 1
        };

        subscription.expiry_epoch = new_expiry;
        subscription.is_active = true;
        subscription.queries_used = 0;

        event::emit(SubscriptionRenewed {
            subscription_id: object::id(subscription),
            consumer: tx_context::sender(ctx),
            new_expiry_epoch: new_expiry,
            payment_amount,
        });
    }

    /// Cancel a subscription
    public entry fun cancel_subscription(
        subscription: &mut Subscription,
        ctx: &mut TxContext
    ) {
        assert!(subscription.consumer == tx_context::sender(ctx), ENotSubscriber);
        subscription.is_active = false;

        event::emit(SubscriptionCancelled {
            subscription_id: object::id(subscription),
            consumer: tx_context::sender(ctx),
        });
    }

    /// Check if user has access to a feed
    public fun check_access(
        subscription: &Subscription,
        consumer: address,
        current_epoch: u64
    ): bool {
        subscription.consumer == consumer &&
        subscription.is_active &&
        current_epoch <= subscription.expiry_epoch
    }

    // =================== View Functions ===================

    public fun get_consumer(subscription: &Subscription): address {
        subscription.consumer
    }

    public fun get_feed_id(subscription: &Subscription): ID {
        subscription.feed_id
    }

    public fun is_active(subscription: &Subscription): bool {
        subscription.is_active
    }

    public fun get_expiry_epoch(subscription: &Subscription): u64 {
        subscription.expiry_epoch
    }

    public fun get_queries_used(subscription: &Subscription): u64 {
        subscription.queries_used
    }

    public fun get_tier(subscription: &Subscription): u8 {
        subscription.tier
    }
}
