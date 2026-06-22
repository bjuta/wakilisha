CREATE POLICY "profiles_own_update" ON community_profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "comments_own_update" ON community_comments FOR UPDATE USING (author_id = auth.uid() AND status IN ('visible', 'pending'));
CREATE POLICY "votes_own_update" ON community_votes FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "follows_own_delete" ON community_follows FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "saves_own_delete" ON community_saves FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "notifications_own_update" ON community_notifications FOR UPDATE USING (user_id = auth.uid());