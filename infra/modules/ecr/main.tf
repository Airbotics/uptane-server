resource "aws_ecr_repository" "airbotics_repository" {
    name                 = "airbotics-repository"
    image_tag_mutability = "IMMUTABLE"
    force_delete         = true

    encryption_configuration {
        encryption_type = "KMS"
    }

    image_scanning_configuration {
        scan_on_push = false
    }
}