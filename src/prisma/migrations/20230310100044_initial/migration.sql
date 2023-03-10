-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('uploading', 'uploaded');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('issuing', 'issued', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "CertificateType" AS ENUM ('provisioning', 'client', 'robot');

-- CreateEnum
CREATE TYPE "TUFRepo" AS ENUM ('director', 'image');

-- CreateEnum
CREATE TYPE "TUFRole" AS ENUM ('root', 'targets', 'snapshot', 'timestamp');

-- CreateEnum
CREATE TYPE "StaticDeltaStatus" AS ENUM ('underway', 'failed', 'succeeded');

-- CreateEnum
CREATE TYPE "ImageFormat" AS ENUM ('ostree', 'binary');

-- CreateEnum
CREATE TYPE "RolloutStatus" AS ENUM ('prepared', 'launched', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "RolloutTargetType" AS ENUM ('group', 'hw_id_match', 'selected_bots');

-- CreateEnum
CREATE TYPE "RolloutRobotStatus" AS ENUM ('pending', 'skipped', 'scheduled', 'accepted', 'completed', 'cancelled', 'failed');

-- CreateEnum
CREATE TYPE "EcuStatus" AS ENUM ('download_started', 'download_completed', 'download_failed', 'installation_started', 'installation_completed', 'installation_failed', 'installation_applied');

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "num_members" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provisioning_credentials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "CertificateStatus" NOT NULL DEFAULT 'issuing',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "client_cert_id" TEXT NOT NULL,
    "provisioning_cert_id" TEXT NOT NULL,

    CONSTRAINT "provisioning_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "team_id" TEXT,
    "serial" TEXT NOT NULL,
    "acm_arn" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,
    "status" "CertificateStatus" NOT NULL DEFAULT 'issuing',
    "cert_type" "CertificateType" NOT NULL,
    "robot_id" TEXT,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "images" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "hwids" TEXT[],
    "status" "UploadStatus" NOT NULL,
    "format" "ImageFormat" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tuf_metadata" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "robot_id" TEXT,
    "role" "TUFRole" NOT NULL,
    "repo" "TUFRepo" NOT NULL,
    "version" INTEGER NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tuf_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "robots" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "agent_version" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "ecus_registered" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "robots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecus" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "robot_id" TEXT NOT NULL,
    "hwid" TEXT NOT NULL,
    "primary" BOOLEAN NOT NULL,
    "image_id" TEXT,
    "status" "EcuStatus" NOT NULL DEFAULT 'installation_completed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ecus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_reports" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "robot_id" TEXT NOT NULL,
    "hostname" TEXT,
    "local_ipv4" TEXT,
    "mac" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installed_packages_reports" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "robot_id" TEXT NOT NULL,
    "packages" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installed_packages_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aktualizr_config_reports" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "robot_id" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aktualizr_config_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hardware_info_reports" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "robot_id" TEXT NOT NULL,
    "hardware_info" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hardware_info_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecu_telemetry" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "ecu_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "device_time" TIMESTAMP(3) NOT NULL,
    "success" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ecu_telemetry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "robot_manifests" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "robot_id" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "valid" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "robot_manifests_pkey" PRIMARY KEY ("team_id","id")
);

-- CreateTable
CREATE TABLE "refs" (
    "name" TEXT NOT NULL,
    "commit" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refs_pkey" PRIMARY KEY ("team_id","name")
);

-- CreateTable
CREATE TABLE "objects" (
    "object_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" "UploadStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "objects_pkey" PRIMARY KEY ("team_id","object_id")
);

-- CreateTable
CREATE TABLE "static_deltas" (
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "status" "StaticDeltaStatus" NOT NULL DEFAULT 'underway',

    CONSTRAINT "static_deltas_pkey" PRIMARY KEY ("team_id","from","to")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "robot_groups" (
    "robot_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "robot_groups_pkey" PRIMARY KEY ("team_id","robot_id","group_id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "team_id" TEXT,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rollouts" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "RolloutStatus" NOT NULL DEFAULT 'prepared',
    "target_type" "RolloutTargetType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rollouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rollout_hardware_images" (
    "id" TEXT NOT NULL,
    "rollout_id" TEXT NOT NULL,
    "team_id" TEXT,
    "hw_id" TEXT NOT NULL,
    "image_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rollout_hardware_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rollout_robots" (
    "id" TEXT NOT NULL,
    "rollout_id" TEXT NOT NULL,
    "robot_id" TEXT,
    "status" "RolloutRobotStatus" NOT NULL DEFAULT 'pending',
    "result_desc" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rollout_robots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rollout_robot_ecus" (
    "id" TEXT NOT NULL,
    "rollout_robot_id" TEXT NOT NULL,
    "ecu_id" TEXT,
    "status" "EcuStatus",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rollout_robot_ecus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_id_key" ON "teams"("id");

-- CreateIndex
CREATE UNIQUE INDEX "provisioning_credentials_id_key" ON "provisioning_credentials"("id");

-- CreateIndex
CREATE UNIQUE INDEX "provisioning_credentials_client_cert_id_key" ON "provisioning_credentials"("client_cert_id");

-- CreateIndex
CREATE UNIQUE INDEX "provisioning_credentials_provisioning_cert_id_key" ON "provisioning_credentials"("provisioning_cert_id");

-- CreateIndex
CREATE UNIQUE INDEX "provisioning_credentials_team_id_id_key" ON "provisioning_credentials"("team_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "provisioning_credentials_team_id_client_cert_id_key" ON "provisioning_credentials"("team_id", "client_cert_id");

-- CreateIndex
CREATE UNIQUE INDEX "provisioning_credentials_team_id_provisioning_cert_id_key" ON "provisioning_credentials"("team_id", "provisioning_cert_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_id_key" ON "certificates"("id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_serial_key" ON "certificates"("serial");

-- CreateIndex
CREATE UNIQUE INDEX "images_id_key" ON "images"("id");

-- CreateIndex
CREATE UNIQUE INDEX "images_team_id_id_key" ON "images"("team_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "images_team_id_sha256_key" ON "images"("team_id", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "tuf_metadata_id_key" ON "tuf_metadata"("id");

-- CreateIndex
CREATE UNIQUE INDEX "robots_id_key" ON "robots"("id");

-- CreateIndex
CREATE UNIQUE INDEX "robots_team_id_id_key" ON "robots"("team_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ecus_id_key" ON "ecus"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ecus_team_id_id_key" ON "ecus"("team_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "network_reports_id_key" ON "network_reports"("id");

-- CreateIndex
CREATE UNIQUE INDEX "network_reports_team_id_id_key" ON "network_reports"("team_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "installed_packages_reports_id_key" ON "installed_packages_reports"("id");

-- CreateIndex
CREATE UNIQUE INDEX "installed_packages_reports_team_id_id_key" ON "installed_packages_reports"("team_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "aktualizr_config_reports_id_key" ON "aktualizr_config_reports"("id");

-- CreateIndex
CREATE UNIQUE INDEX "aktualizr_config_reports_team_id_id_key" ON "aktualizr_config_reports"("team_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "hardware_info_reports_id_key" ON "hardware_info_reports"("id");

-- CreateIndex
CREATE UNIQUE INDEX "hardware_info_reports_team_id_id_key" ON "hardware_info_reports"("team_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ecu_telemetry_id_key" ON "ecu_telemetry"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ecu_telemetry_team_id_id_key" ON "ecu_telemetry"("team_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "groups_id_key" ON "groups"("id");

-- CreateIndex
CREATE UNIQUE INDEX "groups_id_team_id_key" ON "groups"("id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_events_id_key" ON "audit_events"("id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_events_id_team_id_key" ON "audit_events"("id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "rollouts_id_key" ON "rollouts"("id");

-- CreateIndex
CREATE UNIQUE INDEX "rollouts_id_team_id_key" ON "rollouts"("id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "rollout_hardware_images_id_key" ON "rollout_hardware_images"("id");

-- CreateIndex
CREATE UNIQUE INDEX "rollout_hardware_images_rollout_id_hw_id_image_id_key" ON "rollout_hardware_images"("rollout_id", "hw_id", "image_id");

-- CreateIndex
CREATE UNIQUE INDEX "rollout_robots_id_key" ON "rollout_robots"("id");

-- CreateIndex
CREATE UNIQUE INDEX "rollout_robots_rollout_id_robot_id_key" ON "rollout_robots"("rollout_id", "robot_id");

-- CreateIndex
CREATE UNIQUE INDEX "rollout_robot_ecus_id_key" ON "rollout_robot_ecus"("id");

-- CreateIndex
CREATE UNIQUE INDEX "rollout_robot_ecus_rollout_robot_id_ecu_id_key" ON "rollout_robot_ecus"("rollout_robot_id", "ecu_id");

-- AddForeignKey
ALTER TABLE "provisioning_credentials" ADD CONSTRAINT "provisioning_credentials_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provisioning_credentials" ADD CONSTRAINT "provisioning_credentials_client_cert_id_fkey" FOREIGN KEY ("client_cert_id") REFERENCES "certificates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provisioning_credentials" ADD CONSTRAINT "provisioning_credentials_provisioning_cert_id_fkey" FOREIGN KEY ("provisioning_cert_id") REFERENCES "certificates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_robot_id_fkey" FOREIGN KEY ("robot_id") REFERENCES "robots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tuf_metadata" ADD CONSTRAINT "tuf_metadata_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tuf_metadata" ADD CONSTRAINT "tuf_metadata_robot_id_fkey" FOREIGN KEY ("robot_id") REFERENCES "robots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robots" ADD CONSTRAINT "robots_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecus" ADD CONSTRAINT "ecus_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecus" ADD CONSTRAINT "ecus_team_id_robot_id_fkey" FOREIGN KEY ("team_id", "robot_id") REFERENCES "robots"("team_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecus" ADD CONSTRAINT "ecus_team_id_image_id_fkey" FOREIGN KEY ("team_id", "image_id") REFERENCES "images"("team_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_reports" ADD CONSTRAINT "network_reports_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_reports" ADD CONSTRAINT "network_reports_team_id_robot_id_fkey" FOREIGN KEY ("team_id", "robot_id") REFERENCES "robots"("team_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installed_packages_reports" ADD CONSTRAINT "installed_packages_reports_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installed_packages_reports" ADD CONSTRAINT "installed_packages_reports_team_id_robot_id_fkey" FOREIGN KEY ("team_id", "robot_id") REFERENCES "robots"("team_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aktualizr_config_reports" ADD CONSTRAINT "aktualizr_config_reports_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aktualizr_config_reports" ADD CONSTRAINT "aktualizr_config_reports_team_id_robot_id_fkey" FOREIGN KEY ("team_id", "robot_id") REFERENCES "robots"("team_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_info_reports" ADD CONSTRAINT "hardware_info_reports_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_info_reports" ADD CONSTRAINT "hardware_info_reports_team_id_robot_id_fkey" FOREIGN KEY ("team_id", "robot_id") REFERENCES "robots"("team_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecu_telemetry" ADD CONSTRAINT "ecu_telemetry_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecu_telemetry" ADD CONSTRAINT "ecu_telemetry_team_id_ecu_id_fkey" FOREIGN KEY ("team_id", "ecu_id") REFERENCES "ecus"("team_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robot_manifests" ADD CONSTRAINT "robot_manifests_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robot_manifests" ADD CONSTRAINT "robot_manifests_team_id_robot_id_fkey" FOREIGN KEY ("team_id", "robot_id") REFERENCES "robots"("team_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refs" ADD CONSTRAINT "refs_team_id_object_id_fkey" FOREIGN KEY ("team_id", "object_id") REFERENCES "objects"("team_id", "object_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refs" ADD CONSTRAINT "refs_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objects" ADD CONSTRAINT "objects_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "static_deltas" ADD CONSTRAINT "static_deltas_team_id_from_fkey" FOREIGN KEY ("team_id", "from") REFERENCES "objects"("team_id", "object_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "static_deltas" ADD CONSTRAINT "static_deltas_team_id_to_fkey" FOREIGN KEY ("team_id", "to") REFERENCES "objects"("team_id", "object_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "static_deltas" ADD CONSTRAINT "static_deltas_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robot_groups" ADD CONSTRAINT "robot_groups_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robot_groups" ADD CONSTRAINT "robot_groups_robot_id_fkey" FOREIGN KEY ("robot_id") REFERENCES "robots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robot_groups" ADD CONSTRAINT "robot_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rollouts" ADD CONSTRAINT "rollouts_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rollout_hardware_images" ADD CONSTRAINT "rollout_hardware_images_team_id_image_id_fkey" FOREIGN KEY ("team_id", "image_id") REFERENCES "images"("team_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rollout_hardware_images" ADD CONSTRAINT "rollout_hardware_images_rollout_id_fkey" FOREIGN KEY ("rollout_id") REFERENCES "rollouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rollout_robots" ADD CONSTRAINT "rollout_robots_rollout_id_fkey" FOREIGN KEY ("rollout_id") REFERENCES "rollouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rollout_robots" ADD CONSTRAINT "rollout_robots_robot_id_fkey" FOREIGN KEY ("robot_id") REFERENCES "robots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rollout_robot_ecus" ADD CONSTRAINT "rollout_robot_ecus_rollout_robot_id_fkey" FOREIGN KEY ("rollout_robot_id") REFERENCES "rollout_robots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rollout_robot_ecus" ADD CONSTRAINT "rollout_robot_ecus_ecu_id_fkey" FOREIGN KEY ("ecu_id") REFERENCES "ecus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
