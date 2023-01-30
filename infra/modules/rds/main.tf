variable tags { }

variable "private_subnet_ids" { }

variable "cluster_identifier" {
    default                 = "airbotics-rds"
}

variable "db_name" {
    sensitive               = true
}

variable "master_username" {
    sensitive               = true
}

variable "master_password" {
    sensitive               = true
}

resource "aws_db_subnet_group" "main" {
    name                    = "rds-subnet-group"
    subnet_ids              = var.private_subnet_ids
    tags                    = var.tags
}

resource "aws_rds_cluster" "backend" {
    cluster_identifier      = var.cluster_identifier
    database_name           = var.db_name
    master_username         = var.master_username
    master_password         = var.master_password
    engine                  = "aurora-postgresql"
    engine_mode             = "serverless"
    apply_immediately       = true
    storage_encrypted       = true
    backup_retention_period = 1
    skip_final_snapshot     = true
    deletion_protection     = true
    enable_http_endpoint    = true
    db_subnet_group_name    = aws_db_subnet_group.main.id

    scaling_configuration {
        min_capacity        = 2
        max_capacity        = 4
    }

    # allowed_security_groups = [""]
    tags                    = var.tags
} 