module iot_marketplace::reputation {
    use sui::event;
    use std::string::{Self, String};
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;

    // =================== Structs ===================

    /// Data quality metrics for a feed
    public struct DataQualityMetrics has key, store {
        id: UID,
        feed_id: ID,
        uptime_percentage: u64, // in basis points (10000 = 100%)
        total_updates: u64,
        missed_updates: u64,
        average_response_time_ms: u64,
        last_update_timestamp: u64,
    }

    /// Rating from a consumer
    public struct Rating has key, store {
        id: UID,
        feed_id: ID,
        consumer: address,
        stars: u8, // 1-5
        comment: String,
        timestamp: u64,
        helpfulness_votes: u64,
    }

    /// Provider reputation summary
    public struct ProviderReputation has key, store {
        id: UID,
        provider: address,
        total_ratings: u64,
        average_rating: u64, // in basis points (500 = 5.00 stars)
        total_revenue: u64,
        total_subscribers: u64,
        response_rate: u64, // percentage of feedback responded to
        verified: bool,
    }

    /// Feedback response from provider
    public struct ProviderResponse has key, store {
        id: UID,
        rating_id: ID,
        provider: address,
        response: String,
        timestamp: u64,
    }

    // =================== Events ===================

    public struct RatingSubmitted has copy, drop {
        rating_id: ID,
        feed_id: ID,
        consumer: address,
        stars: u8,
        timestamp: u64,
    }

    public struct ProviderResponded has copy, drop {
        response_id: ID,
        rating_id: ID,
        provider: address,
        timestamp: u64,
    }

    public struct MetricsUpdated has copy, drop {
        feed_id: ID,
        uptime_percentage: u64,
        total_updates: u64,
    }

    public struct ProviderVerified has copy, drop {
        provider: address,
        timestamp: u64,
    }

    // =================== Errors ===================

    const EInvalidRating: u64 = 1;
    const ENotProvider: u64 = 2;
    // Remove unused constants to reduce warnings

    // =================== Initialization ===================

    // No init needed for this module

    // =================== Public Functions ===================

    /// Submit a rating for a data feed
    public entry fun submit_rating(
        feed_id: ID,
        stars: u8,
        comment: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(stars >= 1 && stars <= 5, EInvalidRating);

        let rating = Rating {
            id: object::new(ctx),
            feed_id,
            consumer: tx_context::sender(ctx),
            stars,
            comment: string::utf8(comment),
            timestamp: tx_context::epoch(ctx),
            helpfulness_votes: 0,
        };

        let rating_id = object::id(&rating);

        event::emit(RatingSubmitted {
            rating_id,
            feed_id,
            consumer: tx_context::sender(ctx),
            stars,
            timestamp: tx_context::epoch(ctx),
        });

        transfer::share_object(rating);
    }

    /// Provider responds to feedback
    public entry fun respond_to_rating(
        rating: &Rating,
        provider: address,
        response: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == provider, ENotProvider);

        let provider_response = ProviderResponse {
            id: object::new(ctx),
            rating_id: object::id(rating),
            provider,
            response: string::utf8(response),
            timestamp: tx_context::epoch(ctx),
        };

        let response_id = object::id(&provider_response);

        event::emit(ProviderResponded {
            response_id,
            rating_id: object::id(rating),
            provider,
            timestamp: tx_context::epoch(ctx),
        });

        transfer::share_object(provider_response);
    }

    /// Vote a rating as helpful
    public entry fun vote_helpful(
        rating: &mut Rating,
        ctx: &mut TxContext
    ) {
        rating.helpfulness_votes = rating.helpfulness_votes + 1;
    }

    /// Initialize data quality metrics for a feed
    public entry fun init_metrics(
        feed_id: ID,
        ctx: &mut TxContext
    ) {
        let metrics = DataQualityMetrics {
            id: object::new(ctx),
            feed_id,
            uptime_percentage: 10000, // Start at 100%
            total_updates: 0,
            missed_updates: 0,
            average_response_time_ms: 0,
            last_update_timestamp: tx_context::epoch(ctx),
        };

        transfer::share_object(metrics);
    }

    /// Update data quality metrics
    public entry fun update_metrics(
        metrics: &mut DataQualityMetrics,
        is_successful_update: bool,
        response_time_ms: u64,
        ctx: &mut TxContext
    ) {
        if (is_successful_update) {
            metrics.total_updates = metrics.total_updates + 1;

            // Update average response time
            let total_time = metrics.average_response_time_ms * (metrics.total_updates - 1);
            metrics.average_response_time_ms = (total_time + response_time_ms) / metrics.total_updates;
        } else {
            metrics.missed_updates = metrics.missed_updates + 1;
        };

        // Calculate uptime percentage
        let total_attempts = metrics.total_updates + metrics.missed_updates;
        if (total_attempts > 0) {
            metrics.uptime_percentage = (metrics.total_updates * 10000) / total_attempts;
        };

        metrics.last_update_timestamp = tx_context::epoch(ctx);

        event::emit(MetricsUpdated {
            feed_id: metrics.feed_id,
            uptime_percentage: metrics.uptime_percentage,
            total_updates: metrics.total_updates,
        });
    }

    /// Initialize provider reputation
    public entry fun init_provider_reputation(
        provider: address,
        ctx: &mut TxContext
    ) {
        let reputation = ProviderReputation {
            id: object::new(ctx),
            provider,
            total_ratings: 0,
            average_rating: 0,
            total_revenue: 0,
            total_subscribers: 0,
            response_rate: 0,
            verified: false,
        };

        transfer::share_object(reputation);
    }

    /// Update provider reputation with new rating
    public entry fun update_reputation_with_rating(
        reputation: &mut ProviderReputation,
        stars: u8,
    ) {
        let total_points = (reputation.average_rating * reputation.total_ratings) + ((stars as u64) * 100);
        reputation.total_ratings = reputation.total_ratings + 1;
        reputation.average_rating = total_points / reputation.total_ratings;
    }

    /// Verify a provider (admin function)
    public entry fun verify_provider(
        reputation: &mut ProviderReputation,
        ctx: &mut TxContext
    ) {
        reputation.verified = true;

        event::emit(ProviderVerified {
            provider: reputation.provider,
            timestamp: tx_context::epoch(ctx),
        });
    }

    // =================== View Functions ===================

    public fun get_rating_stars(rating: &Rating): u8 {
        rating.stars
    }

    public fun get_rating_consumer(rating: &Rating): address {
        rating.consumer
    }

    public fun get_uptime_percentage(metrics: &DataQualityMetrics): u64 {
        metrics.uptime_percentage
    }

    public fun get_total_updates(metrics: &DataQualityMetrics): u64 {
        metrics.total_updates
    }

    public fun get_average_rating(reputation: &ProviderReputation): u64 {
        reputation.average_rating
    }

    public fun is_verified(reputation: &ProviderReputation): bool {
        reputation.verified
    }

    public fun get_total_ratings(reputation: &ProviderReputation): u64 {
        reputation.total_ratings
    }
}

