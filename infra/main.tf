terraform {
    required_version        = ">= v1.3.7"
    
    required_providers {
        aws = {
            source          = "hashicorp/aws"
            version         = "~> 4.52"
        }
    }

    # backend "s3" {
    #     bucket  = "airbotics-terraform-backend"
    #     encrypt = true
    #     key     = "terraform.tfstate"
    # }

}

variable "tags" {
    default = {
        Terraform               = "true"
        Environment             = "dev"
    }
}

variable "region" {
    default                 = "eu-west-1"
}

provider "aws" {
    region                  = var.region
}


# module "network" {
#     source                  = "./modules/network"
#     az_count                = "3"
#     vpc_cidr_block          = "172.16.0.0/16"
#     tags                    = var.tags
# }

# module "s3" {
#     source                  = "./modules/s3"
#     treehub_bucket_name     = "airbotics-treehub"
#     tags                    = var.tags
# }

module "ecr" {
    source                  = "./modules/ecr"
    num_images_to_retain    = 10
    repository_name         = "backend-repository"
    tags                    = var.tags
}

# module "rds" {
#     source                  = "./modules/rds"
#     cluster_identifier      = "airbotics-rds"
#     db_name                 = "test-db-name"
#     master_username         = "test-db-user"
#     master_password         = "test-db-password"
#     private_subnet_ids      = module.network.private_subnet_ids
#     tags                    = var.tags

#     depends_on              = [ module.network ]
# }

# module "ecs" {
#     source                  = "./modules/ecs"
#     cluster_name            = "airbotics-cluster"
#     task_definition_name    = "airbotics-task"
#     task_service_name       = "airbotics-service"
#     private_subnet_ids      = module.network.private_subnet_ids
#     tags                    = var.tags

#     depends_on              = [ module.network ]
# }

# module "acm-pca" {
#     source                  = "./modules/acm-pca"
#     root_ca_country         = "US"
#     root_ca_state           = "CA"
#     root_ca_locality        = "San Francisco"
#     root_ca_organization    = "Airbotics Inc."
    # tags                    = var.tags
# }

# module "api-gateway" {
#     source                  = "./modules/api-gateway"
    # tags                    = var.tags
# }