variable tags { }

resource "aws_api_gateway_client_certificate" "api_gateway_client_cert" {
    description = "API client certificate"

    tags                    = var.tags
}

resource "aws_api_gateway_domain_name" "gateway_domain" {
    domain_name         = "gateway.airbotics.io"
    security_policy     = "TLS_1_2"

    endpoint_configuration {
        types           = ["REGIONAL"]
    }
    # ownership_verification_certificate_arn =

    # mutual_tls_authentication {
        # truststore_uri = "s3://bucket-name/key-name"
    # }

    # depends_on = [aws_acm_certificate_validation.cert]

    tags                    = var.tags
}

resource "aws_api_gateway_stage" "example" {
    deployment_id   = aws_api_gateway_deployment.example.id
    rest_api_id     = aws_api_gateway_rest_api.example.id
    stage_name      = "default"

    tags                    = var.tags
}

resource "aws_api_gateway_base_path_mapping" "example" {
    api_id          = aws_api_gateway_rest_api.example.id
    stage_name      = aws_api_gateway_stage.example.stage_name
    domain_name     = aws_api_gateway_domain_name.example.domain_name

    tags                    = var.tags
}