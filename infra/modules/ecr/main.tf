variable tags { }

variable "num_images_to_retain" {
    default     = 10
}

variable "repository_name" {
    default     = "backend-repository"
}

# repo to source application code
resource "aws_ecr_repository" "backend_repo" {
    name                    = var.repository_name
    image_tag_mutability    = "IMMUTABLE"
    force_delete            = true

    encryption_configuration {
        encryption_type     = "KMS"
    }

    image_scanning_configuration {
        scan_on_push        = false
    }

    tags                    = var.tags
}


resource "aws_ecr_lifecycle_policy" "backend_repo_lifecycle" {
    repository = aws_ecr_repository.backend_repo.name
    policy = jsonencode({
        rules = [{
            rulePriority    = 1
            description     = "keep last ${var.num_images_to_retain} images"
            action          = {
                type        = "expire"
            }
            selection       = {
                tagStatus   = "any"
                countType   = "imageCountMoreThan"
                countNumber = var.num_images_to_retain
            }
        }]
    })

}

output "aws_ecr_repository_url" {
    value                   = aws_ecr_repository.backend_repo.repository_url
}