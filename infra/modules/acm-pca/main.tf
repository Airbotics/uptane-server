variable tags { }

variable "root_ca_country" {
    default     = "US"
}

variable "root_ca_state" {
    default     = "CA"
}

variable "root_ca_locality" {
    default     = "San Francisco"
}

variable "root_ca_organization" {
    default     = "Airbotics Inc."
}


resource "aws_acmpca_certificate_authority" "root_ca" {
    type                    = "ROOT"

    certificate_authority_configuration {
        key_algorithm       = "RSA_4096"
        signing_algorithm   = "SHA512WITHRSA"

        subject {
            # common_name     = "airbotics.io"
            country         = var.root_ca_country
            state           = var.root_ca_state
            locality        = var.root_ca_locality
            organization    = var.root_ca_organization
        }
    }
    
    revocation_configuration {
        ocsp_configuration {
            enabled             = true
        }
    }

    tags                    = var.tags

}
