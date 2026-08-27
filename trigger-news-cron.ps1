$envContent = Get-Content .env.local
$secretLine = $envContent | Select-String "^CRON_SECRET="
$secret = $secretLine.ToString().Split("=", 2)[1]

Write-Host "Secret length: $($secret.Length)"

$response = curl.exe -H "Authorization: Bearer $secret" https://atlas-intelligence-six.vercel.app/api/cron/news-ingest
Write-Host $response