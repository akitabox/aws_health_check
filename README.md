# AWS Health Check
Express middleware for responding to AWS health check requests from Route53 and ELB

## Installation
`npm install @akitabox/aws_health_check --save`

## Usage

Configure application health check requests in Route53 and ELB to ping `HTTP:3000/heartbeat`

Example `app.js`
```
var express = require('express');
var awsHealthCheck = require('@akitabox/aws_health_check');
var app = express();

// Respond to health check requests sent to this application
app.use(awsHealthCheck());

app.listen(3000, function () {
  console.log('Simple app listening on port 3000!');
});

```
