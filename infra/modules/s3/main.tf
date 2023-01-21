resource "aws_s3_bucket" "airbotics_treehub_bucket" {
    bucket              = "airbotics-treehub" 
    force_destroy       = true
    lifecycle {
        prevent_destroy = true
    }
}

resource "aws_s3_bucket_public_access_block" "public_access" {
    bucket                      = aws_s3_bucket.airbotics_treehub_bucket.id
    block_public_acls           = true
    block_public_policy         = true
    ignore_public_acls          = true
    restrict_public_buckets     = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "encryption" {
    bucket                      = aws_s3_bucket.airbotics_treehub_bucket.id
    rule {
        apply_server_side_encryption_by_default {
            sse_algorithm = "AES256"
        }
    }
}

resource "aws_s3_bucket_versioning" "versioning" {
    bucket          = aws_s3_bucket.airbotics_treehub_bucket.id
    versioning_configuration {
        status      = "Disabled"
    }
}

resource "aws_s3_bucket_acl" "acl" {
    bucket      = aws_s3_bucket.airbotics_treehub_bucket.id
    acl         = "private"
}
