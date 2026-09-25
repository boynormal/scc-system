-- Driver finish check-in waits for office review before the job is closed.
ALTER TYPE "TransportJobStatus" ADD VALUE IF NOT EXISTS 'pending_review';
