terraform {
    required_providers {
        aws = {
            source  = "hashicorp/aws"
            version = "~> 4.16"
        }
    }
}

variable "region" {
    default = "eu-west-1"
}

provider "aws" {
    region = var.region
}

module "s3" {
    source = "./modules/s3"
}

module "ecr" {
    source = "./modules/ecr"
}

module "rds" {
    source = "./modules/rds"
}