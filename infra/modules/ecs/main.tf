variable tags { }

variable "private_subnet_ids" { }

variable "cluster_name" {
    default                     = "airbotics-cluster"
}

variable "task_definition_name" {
    default                     = "airbotics-task"
}

variable "task_service_name" {
    default                     = "airbotics-service"
}

resource "aws_ecs_cluster" "backend" {
    name                        = var.cluster_name
    tags                        = var.tags
}

# env variables:
# PORT=8001
# NODE_ENV="development"
# POSTGRES_CONN_STR
# AWS_ACM_PCA_ROOT_CA_ARN
# ORY_PROJECT_URL
# ORY_ACCESS_TOKEN=
# ORY_SCHEMA_ID


resource "aws_ecs_task_definition" "backend" {

    family                      = var.task_definition_name
    network_mode                = "awsvpc"
    requires_compatibilities    = ["FARGATE"]
    cpu                         = 256
    memory                      = 512

    container_definitions = jsonencode([{
        name                    = "httpd-container"
        image                   = "docker.io/httpd:latest"
        essential               = true
        portMappings = [{
            protocol            = "tcp"
            containerPort       = 80
            hostPort            = 80
        }]
        # environment = var.container_environment
    }])

    tags                        = var.tags
}


resource "aws_ecs_service" "backend" {
    name                        = var.task_service_name
    cluster                     = aws_ecs_cluster.backend.id
    task_definition             = aws_ecs_task_definition.backend.arn
    desired_count               = 1
    launch_type                 = "FARGATE"

    network_configuration {
        subnets                 = var.private_subnet_ids
    }

    tags                        = var.tags
}