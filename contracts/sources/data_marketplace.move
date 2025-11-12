module iot_data_marketplace::data_marketplace {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use std::string::{Self, String};
    use std::vector;

    // =================== Structs ===================

    /// Represents a data feed from an IoT device
    public struct DataFeed has key, store {
        id: UID,
        provider: address,
        name: String,
        category: String,
        description: String,
        location: String,
        price_per_query: u64, // Price in MIST (1 SUI = 10^9 MIST)
        monthly_subscription_price: u64,
        is_premium: bool,
        walrus_blob_id: String,
        created_at: u64,
        last_updated: u64,
        is_active: bool,
        update_frequency: u64, // in seconds
        total_subscribers: u64,
        total_revenue: u64,
    }

    /// Admin capability for marketplace management
    public struct MarketplaceAdmin has key {
        id: UID,
    }

    /// Registry to track all data feeds
    public struct DataFeedRegistry has key {
        id: UID,
        feed_count: u64,
        platform_fee_percentage: u64, // in basis points (e.g., 500 = 5%)
    }

    // =================== Events ===================

    public struct FeedRegistered has copy, drop {
        feed_id: ID,
        provider: address,
        name: String,
        category: String,
        price_per_query: u64,
        monthly_subscription_price: u64,
        is_premium: bool,
    }

    public struct DataUpdated has copy, drop {
        feed_id: ID,
        provider: address,
        new_walrus_blob_id: String,
        timestamp: u64,
    }

    public struct FeedDeactivated has copy, drop {
        feed_id: ID,
        provider: address,
    }

    public struct FeedReactivated has copy, drop {
        feed_id: ID,
        provider: address,
    }

    // =================== Errors ===================

    const ENotProvider: u64 = 1;
    const EFeedInactive: u64 = 2;
    const EInvalidPrice: u64 = 3;
    const EInvalidFeePercentage: u64 = 4;

    // =================== Initialization ===================

    /// Initialize the marketplace - called once during deployment
    fun init(ctx: &mut TxContext) {
        // Create admin capability
        let admin = MarketplaceAdmin {
            id: object::new(ctx),
        };
        transfer::transfer(admin, tx_context::sender(ctx));

        // Create registry
        let registry = DataFeedRegistry {
            id: object::new(ctx),
            feed_count: 0,
            platform_fee_percentage: 500, // 5% platform fee
        };
        transfer::share_object(registry);
    }

    // =================== Public Functions ===================

    /// Register a new data feed
    public entry fun register_data_feed(
        registry: &mut DataFeedRegistry,
        name: vector<u8>,
        category: vector<u8>,
        description: vector<u8>,
        location: vector<u8>,
        price_per_query: u64,
        monthly_subscription_price: u64,
        is_premium: bool,
        walrus_blob_id: vector<u8>,
        update_frequency: u64,
        ctx: &mut TxContext
    ) {
        assert!(price_per_query > 0 || monthly_subscription_price > 0, EInvalidPrice);

        let feed = DataFeed {
            id: object::new(ctx),
            provider: tx_context::sender(ctx),
            name: string::utf8(name),
            category: string::utf8(category),
            description: string::utf8(description),
            location: string::utf8(location),
            price_per_query,
            monthly_subscription_price,
            is_premium,
            walrus_blob_id: string::utf8(walrus_blob_id),
            created_at: tx_context::epoch(ctx),
            last_updated: tx_context::epoch(ctx),
            is_active: true,
            update_frequency,
            total_subscribers: 0,
            total_revenue: 0,
        };

        let feed_id = object::id(&feed);
        registry.feed_count = registry.feed_count + 1;

        event::emit(FeedRegistered {
            feed_id,
            provider: tx_context::sender(ctx),
            name: string::utf8(name),
            category: string::utf8(category),
            price_per_query,
            monthly_subscription_price,
            is_premium,
        });

        transfer::share_object(feed);
    }

    /// Update data feed with new Walrus blob ID
    public entry fun update_feed_data(
        feed: &mut DataFeed,
        new_walrus_blob_id: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(feed.provider == tx_context::sender(ctx), ENotProvider);
        assert!(feed.is_active, EFeedInactive);

        feed.walrus_blob_id = string::utf8(new_walrus_blob_id);
        feed.last_updated = tx_context::epoch(ctx);

        event::emit(DataUpdated {
            feed_id: object::id(feed),
            provider: tx_context::sender(ctx),
            new_walrus_blob_id: string::utf8(new_walrus_blob_id),
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Update pricing for a data feed
    public entry fun update_pricing(
        feed: &mut DataFeed,
        new_price_per_query: u64,
        new_monthly_subscription_price: u64,
        ctx: &mut TxContext
    ) {
        assert!(feed.provider == tx_context::sender(ctx), ENotProvider);
        assert!(new_price_per_query > 0 || new_monthly_subscription_price > 0, EInvalidPrice);

        feed.price_per_query = new_price_per_query;
        feed.monthly_subscription_price = new_monthly_subscription_price;
    }

    /// Deactivate a data feed
    public entry fun deactivate_feed(
        feed: &mut DataFeed,
        ctx: &mut TxContext
    ) {
        assert!(feed.provider == tx_context::sender(ctx), ENotProvider);
        feed.is_active = false;

        event::emit(FeedDeactivated {
            feed_id: object::id(feed),
            provider: tx_context::sender(ctx),
        });
    }

    /// Reactivate a data feed
    public entry fun reactivate_feed(
        feed: &mut DataFeed,
        ctx: &mut TxContext
    ) {
        assert!(feed.provider == tx_context::sender(ctx), ENotProvider);
        feed.is_active = true;

        event::emit(FeedReactivated {
            feed_id: object::id(feed),
            provider: tx_context::sender(ctx),
        });
    }

    /// Increment subscriber count (called by subscription module)
    public(package) fun increment_subscribers(feed: &mut DataFeed) {
        feed.total_subscribers = feed.total_subscribers + 1;
    }

    /// Add revenue to feed (called by subscription module)
    public(package) fun add_revenue(feed: &mut DataFeed, amount: u64) {
        feed.total_revenue = feed.total_revenue + amount;
    }

    // =================== View Functions ===================

    public fun get_provider(feed: &DataFeed): address {
        feed.provider
    }

    public fun get_price_per_query(feed: &DataFeed): u64 {
        feed.price_per_query
    }

    public fun get_monthly_subscription_price(feed: &DataFeed): u64 {
        feed.monthly_subscription_price
    }

    public fun is_active(feed: &DataFeed): bool {
        feed.is_active
    }

    public fun is_premium(feed: &DataFeed): bool {
        feed.is_premium
    }

    public fun get_walrus_blob_id(feed: &DataFeed): String {
        feed.walrus_blob_id
    }

    public fun get_platform_fee_percentage(registry: &DataFeedRegistry): u64 {
        registry.platform_fee_percentage
    }
}
