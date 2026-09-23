-- Trip bookend punch kinds. New values are unused in this migration so PostgreSQL can commit them.
-- Rollback: not reversible while rows use the new values; drop later constraints first.

ALTER TYPE "JobStopPunchKind" ADD VALUE 'start';
ALTER TYPE "JobStopPunchKind" ADD VALUE 'finish';
