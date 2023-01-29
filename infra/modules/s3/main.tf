variable tags { }

variable "treehub_bucket_name" {
    default                     = "airbotics-treehub"
}

resource "aws_s3_bucket" "treehub_bucket" {
    bucket                      = var.treehub_bucket_name
    force_destroy               = true
    lifecycle {
        prevent_destroy         = true
    }
    tags = var.tags
}

resource "aws_s3_bucket_public_access_block" "public_access" {
    bucket                      = aws_s3_bucket.treehub_bucket.id
    block_public_acls           = true
    block_public_policy         = true
    ignore_public_acls          = true
    restrict_public_buckets     = true
    tags                    = var.tags
}

resource "aws_s3_bucket_server_side_encryption_configuration" "encryption" {
    bucket                      = aws_s3_bucket.treehub_bucket.id
    rule {
        apply_server_side_encryption_by_default {
            sse_algorithm       = "AES256"
        }
    }
    tags                    = var.tags
}

resource "aws_s3_bucket_versioning" "versioning" {
    bucket                      = aws_s3_bucket.treehub_bucket.id
    versioning_configuration {
        status                  = "Disabled"
    }
    tags                    = var.tags
}

resource "aws_s3_bucket_acl" "acl" {
    bucket                      = aws_s3_bucket.treehub_bucket.id
    acl                         = "private"
    tags                    = var.tags
}
