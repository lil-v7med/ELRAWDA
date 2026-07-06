# ELRAWDA Native Windows PowerShell Web Server
# Serves the integrated wealth management application locally

$port = 8000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  ELRAWDA Family Finance Glass Core Web Server Running" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  Access the application locally at:" -ForegroundColor Cyan
    Write-Host "  ---> http://localhost:$port/ <---" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  Press Ctrl+C in this terminal window to stop the server." -ForegroundColor Yellow
    Write-Host ""
}
catch {
    Write-Error "Failed to start listener on port $port. Check if the port is already in use."
    exit
}

# Mapping of file extensions to MIME types
$mimeTypes = @{
    ".html" = "text/html"
    ".css"  = "text/css"
    ".js"   = "application/javascript"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
}

# Main event loop
while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/") {
            $urlPath = "/index.html"
        }

        # Resolve local file path
        $localFilePath = Join-Path $PSScriptRoot $urlPath

        if (Test-Path $localFilePath -PathType Leaf) {
            # Retrieve MIME type
            $ext = [System.IO.Path]::GetExtension($localFilePath).ToLower()
            $contentType = $mimeTypes[$ext]
            if ($null -eq $contentType) {
                $contentType = "application/octet-stream"
            }

            # Read file bytes
            $bytes = [System.IO.File]::ReadAllBytes($localFilePath)

            # Set headers and response
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate")
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            # File Not Found (404)
            $notFoundMsg = "404 - File Not Found: $urlPath"
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($notFoundMsg)
            $response.StatusCode = 404
            $response.ContentType = "text/plain"
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        }
    }
    catch {
        # Handle exceptions gracefully
        if ($listener.IsListening) {
            Write-Host "Request handling error: $_" -ForegroundColor Red
        }
    }
    finally {
        if ($null -ne $response) {
            $response.Close()
        }
    }
}
