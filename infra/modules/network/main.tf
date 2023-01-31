variable tags { }

# this module creates:
# vpc
# public subnets
# private subnets
# igw
# nat gateway
# eip for nat
# public and private route table
# route table association
# public and private routes

# eu-west-1 has 3 AZs
variable "az_count" {
    default                 = "3"
}

variable "vpc_cidr_block" {
    default                 = "172.16.0.0/16"
}

variable "public_cidr_block" {
    default                 = "0.0.0.0/0"
}

# gets availability zones in the current region
data "aws_availability_zones" "azs" { }


# main vpc
resource "aws_vpc" "main" {
    cidr_block              = var.vpc_cidr_block
    tags                    = var.tags
}


# create az_count public subnets
resource "aws_subnet" "public_subnets" {
    vpc_id                  = aws_vpc.main.id
    count                   = var.az_count
    cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, var.az_count + count.index)
    availability_zone       = data.aws_availability_zones.azs.names[count.index]
    map_public_ip_on_launch = true
    tags                    = var.tags
}


# create az_count private subnets
resource "aws_subnet" "private_subnets" {
    vpc_id                  = aws_vpc.main.id
    count                   = var.az_count
    cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
    availability_zone       = data.aws_availability_zones.azs.names[count.index]
    tags                    = var.tags
}


# internet gateway for public subnets
resource "aws_internet_gateway" "igw" {
    vpc_id                  = aws_vpc.main.id
    tags                    = var.tags
}


# nat gateway for private subnets
resource "aws_nat_gateway" "nat_gw" {
    count                   = var.az_count
    subnet_id               = element(aws_subnet.public_subnets.*.id, count.index)
    allocation_id           = element(aws_eip.nat_eip.*.id, count.index)
    depends_on              = [aws_internet_gateway.igw]
    tags                    = var.tags
}

# elastic ips for nat gateway
resource "aws_eip" "nat_eip" {
    count                   = var.az_count
    vpc                     = true
    depends_on              = [aws_internet_gateway.igw]
    tags                    = var.tags
}


# public route table
resource "aws_route_table" "public" {
    vpc_id                  = aws_vpc.main.id
    tags                    = var.tags
}


# private route table
resource "aws_route_table" "private" {
    count                   = var.az_count
    vpc_id                  = aws_vpc.main.id
    tags                    = var.tags
}


# associate with public subnets
resource "aws_route_table_association" "public" {
    count                   = var.az_count
    subnet_id               = element(aws_subnet.public_subnets.*.id, count.index)
    route_table_id          = aws_route_table.public.id
}


# associate with private subnets
resource "aws_route_table_association" "private" {
    count                   = var.az_count
    subnet_id               = element(aws_subnet.private_subnets.*.id, count.index)
    route_table_id          = element(aws_route_table.private.*.id, count.index)
}


# route public subnets traffic through internet gateway
resource "aws_route" "public" {
    route_table_id          = aws_route_table.public.id
    destination_cidr_block  = var.public_cidr_block
    gateway_id              = aws_internet_gateway.igw.id
}


# route non-local traffic of private subnet through the NAT gateway to the internet
resource "aws_route" "private" {
    count                   = var.az_count
    route_table_id          = element(aws_route_table.private.*.id, count.index)
    destination_cidr_block  = var.public_cidr_block
    nat_gateway_id          = element(aws_nat_gateway.nat_gw.*.id, count.index)
}

output "private_subnet_ids" {
    value = aws_subnet.private_subnets.*.id
}