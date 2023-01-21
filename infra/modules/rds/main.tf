resource "aws_rds_cluster" "airbotics_rds" {

    cluster_identifier      = "airbotics-rds"

    engine                  = "aurora-postgresql"
    engine_mode             = "serverless"

    port                    = 5411
    database_name           = "foo"
    master_username         = "foo"
    master_password         = "bar"
    apply_immediately       = true
    storage_encrypted       = true
    backup_retention_period = 1
    skip_final_snapshot     = true

} 