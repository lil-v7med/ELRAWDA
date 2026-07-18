-- =========================================================================
-- ELRAWDA Migration: 003_storage.sql
-- Provisions the public receipts storage bucket and RLS policies.
-- =========================================================================

-- Create receipts storage bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow public read access to files inside receipts bucket
CREATE POLICY "Public Read Access to Receipts Bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts');

-- Allow authenticated users to upload files inside receipts bucket
CREATE POLICY "Authenticated Users Can Upload Receipts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'receipts');

-- Allow authenticated users to update their own files inside receipts bucket
CREATE POLICY "Authenticated Users Can Update Receipts"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'receipts');

-- Allow authenticated users to delete files inside receipts bucket
CREATE POLICY "Authenticated Users Can Delete Receipts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'receipts');
