-- Migration 0005: Add alex_message column to home_state
-- This stores Alex's persistent message for Fox (Hearth-style presence feature)

ALTER TABLE home_state ADD COLUMN alex_message TEXT DEFAULT '';
