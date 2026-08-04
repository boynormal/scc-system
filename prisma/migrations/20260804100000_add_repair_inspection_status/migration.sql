-- AlterEnum: add inspection between in_repair and closed (workflow: in_repair → inspection → closed)
ALTER TYPE "TransportRepairStatus" ADD VALUE IF NOT EXISTS 'inspection';
