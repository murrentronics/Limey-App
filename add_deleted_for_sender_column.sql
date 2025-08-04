-- Add deleted_for_sender column to messages table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'deleted_for_sender'
    ) THEN
        ALTER TABLE messages ADD COLUMN deleted_for_sender BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add deleted_for_receiver column to messages table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'deleted_for_receiver'
    ) THEN
        ALTER TABLE messages ADD COLUMN deleted_for_receiver BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add deleted_for_everyone column to messages table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'deleted_for_everyone'
    ) THEN
        ALTER TABLE messages ADD COLUMN deleted_for_everyone BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_messages_deleted_for_sender ON messages(deleted_for_sender);
CREATE INDEX IF NOT EXISTS idx_messages_deleted_for_receiver ON messages(deleted_for_receiver);
CREATE INDEX IF NOT EXISTS idx_messages_deleted_for_everyone ON messages(deleted_for_everyone); 