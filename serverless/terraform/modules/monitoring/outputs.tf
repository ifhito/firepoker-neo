output "alarm_names" {
  description = "Names of the CloudWatch alarms provisioned by the monitoring module"
  value = [
    aws_cloudwatch_metric_alarm.connections_active.alarm_name,
    aws_cloudwatch_metric_alarm.lambda_throttles.alarm_name,
    aws_cloudwatch_metric_alarm.apigw_5xx.alarm_name,
  ]
}
