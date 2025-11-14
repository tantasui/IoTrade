// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module iot_marketplace::seal_access {
    use iot_marketplace::data_marketplace::{Self, DataFeed};
    use iot_marketplace::subscription::{Self, Subscription};

    // =================== Errors ===================
    
    const ENoAccess: u64 = 8;

    // =================== Seal Access Policy ===================

    /// Check if access should be granted for Seal decryption
    /// This function verifies subscription validity before Seal key servers provide decryption keys
    fun check_policy(
        id: vector<u8>,
        feed: &DataFeed,
        subscription: &Subscription,
        ctx: &sui::tx_context::TxContext
    ): bool {
        let consumer = sui::tx_context::sender(ctx);
        let current_epoch = sui::tx_context::epoch(ctx);

        // Verify feed is active
        if (!data_marketplace::is_active(feed)) {
            return false
        };

        // Verify feed is premium (only premium feeds use Seal encryption)
        if (!data_marketplace::is_premium(feed)) {
            return false
        };

        // Verify subscription belongs to the requester
        if (subscription::get_consumer(subscription) != consumer) {
            return false
        };

        // Verify subscription is active
        if (!subscription::is_active(subscription)) {
            return false
        };

        // Verify subscription hasn't expired
        if (current_epoch > subscription::get_expiry_epoch(subscription)) {
            return false
        };

        // Verify subscription is for this feed
        if (subscription::get_feed_id(subscription) != sui::object::id(feed)) {
            return false
        };

        // Verify the id matches the feed ID (Seal identity format: [package_id][feed_id])
        let feed_id_bytes = sui::object::id(feed).to_bytes();
        // The id should end with feed_id_bytes (package_id is prepended by Seal)
        let mut i = 0;
        let feed_id_len = feed_id_bytes.length();
        let id_len = id.length();
        
        if (feed_id_len > id_len) {
            return false
        };

        // Check if id ends with feed_id_bytes
        while (i < feed_id_len) {
            if (id[id_len - feed_id_len + i] != feed_id_bytes[i]) {
                return false
            };
            i = i + 1;
        };

        true
    }

    /// Approve Seal encryption access for a premium feed subscription
    /// This function is called by Seal key servers to verify access before providing decryption keys
    /// 
    /// Parameters:
    /// - id: Seal identity (vector<u8>) - format: [package_id][feed_id]
    /// - feed: The data feed being accessed
    /// - subscription: The subscription object (must be owned by the requester)
    /// - ctx: Transaction context
    entry fun seal_approve(
        id: vector<u8>,
        feed: &DataFeed,
        subscription: &Subscription,
        ctx: & TxContext
    ) {
        assert!(check_policy(id, feed, subscription, ctx), ENoAccess);
    }

    /// Get Seal identity for a feed
    /// Seal identity format: [package_id][feed_id]
    /// Seal automatically prefixes with package ID, so we only need feed_id
    public fun get_seal_identity(feed: &DataFeed): sui::object::ID {
        sui::object::id(feed)
    }

    /// Check if a subscription grants access to decrypt a premium feed
    public fun can_decrypt(
        feed: &DataFeed,
        subscription: &Subscription,
        consumer: address,
        current_epoch: u64
    ): bool {
        // Feed must be active and premium
        if (!data_marketplace::is_active(feed) || !data_marketplace::is_premium(feed)) {
            return false
        };

        // Subscription must belong to consumer
        if (subscription::get_consumer(subscription) != consumer) {
            return false
        };

        // Subscription must be active and not expired
        if (!subscription::is_active(subscription) || current_epoch > subscription::get_expiry_epoch(subscription)) {
            return false
        };

        // Subscription must be for this feed
        if (subscription::get_feed_id(subscription) != sui::object::id(feed)) {
            return false
        };

        true
    }
}
