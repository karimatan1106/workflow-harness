# N-46: OPA/Conftest policy — No public S3 buckets (scaffold)
# Usage: conftest test --policy policies/ terraform.tfplan.json
package main

deny[msg] {
  input.resource_type == "aws_s3_bucket"
  input.values.acl == "public-read"
  msg := sprintf("S3 bucket %s must not be public-read", [input.address])
}

deny[msg] {
  input.resource_type == "aws_s3_bucket"
  input.values.acl == "public-read-write"
  msg := sprintf("S3 bucket %s must not be public-read-write", [input.address])
}

deny[msg] {
  input.resource_type == "aws_s3_bucket_policy"
  contains(input.values.policy, "\"Principal\":\"*\"")
  msg := sprintf("S3 bucket policy %s must not allow public access via Principal:*", [input.address])
}
