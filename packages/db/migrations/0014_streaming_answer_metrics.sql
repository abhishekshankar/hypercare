-- TASK-031: streaming first-byte and total duration for operator metrics (nullable for non-streaming rows).
ALTER TABLE messages ADD COLUMN IF NOT EXISTS stream_first_chunk_ms integer;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS stream_total_ms integer;
