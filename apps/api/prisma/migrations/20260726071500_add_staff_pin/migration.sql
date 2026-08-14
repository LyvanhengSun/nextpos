-- PINs are bcrypt hashes; the plain PIN is never stored.
ALTER TABLE "User" ADD COLUMN "pinHash" TEXT;
