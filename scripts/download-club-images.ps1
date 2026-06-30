$ErrorActionPreference = "Stop"

$ImageFolder = "assets\img\clubs"
$SourceCsv = "assets\img\clubs\image-sources.csv"

New-Item -ItemType Directory -Force $ImageFolder | Out-Null

$RequestDelaySeconds = 8
$RetryDelaySeconds = 45
$ThumbnailWidth = 1200

$images = @(
  @{
    Club = "Aldinga Bay Surf Life Saving Club"
    FileName = "aldinga-bay-surf-life-saving-club.jpg"
    WikimediaFile = "Aerial_-_Southern_Beaches.jpg"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Aerial_-_Southern_Beaches.jpg"
    Notes = "Open-source locality image. Verify licence and attribution before public launch."
  },
  @{
    Club = "Beachport Surf Life Saving Club"
    FileName = "beachport-surf-life-saving-club.jpg"
    WikimediaFile = "Penguin_Island,_Beachport_South_Australia.jpg"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Penguin_Island,_Beachport_South_Australia.jpg"
    Notes = "Open-source locality image. Verify licence and attribution before public launch."
  },
  @{
    Club = "Brighton Surf Life Saving Club"
    FileName = "brighton-surf-life-saving-club.jpg"
    WikimediaFile = "Brighton_Beach,_South_Australia.jpg"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Brighton_Beach,_South_Australia.jpg"
    Notes = "Open-source locality image. Verify licence and attribution before public launch."
  },
  @{
    Club = "Chiton Rocks Surf Life Saving Club"
    FileName = "chiton-rocks-surf-life-saving-club.jpg"
    WikimediaFile = "Horseshoe_Bay_panorama.jpg"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Horseshoe_Bay_panorama.jpg"
    Notes = "Temporary nearby Fleurieu locality image. Replace with Chiton Rocks club-approved image when available."
  },
  @{
    Club = "Christies Beach Surf Life Saving Club"
    FileName = "christies-beach-surf-life-saving-club.jpg"
    WikimediaFile = "Christies_Beach_Coastline.JPG"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Christies_Beach_Coastline.JPG"
    Notes = "Open-source locality image. Verify licence and attribution before public launch."
  },
  @{
    Club = "Elizabeth Life Saving Club"
    FileName = "elizabeth-life-saving-club.jpg"
    WikimediaFile = "Playford_Civic_Centre.jpg"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Playford_Civic_Centre.jpg"
    Notes = "Open-source Elizabeth locality image. Not a club image."
  },
  @{
    Club = "Glenelg Surf Life Saving Club"
    FileName = "glenelg-surf-life-saving-club.jpg"
    WikimediaFile = "Adelaide_-_Glenelg_Beach_(4158746916).jpg"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Adelaide_-_Glenelg_Beach_(4158746916).jpg"
    Notes = "Open-source locality image. Verify licence and attribution before public launch."
  },
  @{
    Club = "Goolwa Surf Life Saving Club"
    FileName = "goolwa-surf-life-saving-club.jpg"
    WikimediaFile = "Goolwa_beach_2009.jpg"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Goolwa_beach_2009.jpg"
    Notes = "Open-source locality image. Verify licence and attribution before public launch."
  },
  @{
    Club = "Grange Surf Life Saving Club"
    FileName = "grange-surf-life-saving-club.jpg"
    WikimediaFile = "Grange_Beach,_South_Australia_(31113824464).jpg"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Grange_Beach,_South_Australia_(31113824464).jpg"
    Notes = "Open-source locality image. Verify licence and attribution before public launch."
  },
  @{
    Club = "Henley Surf Life Saving Club"
    FileName = "henley-surf-life-saving-club.jpg"
    WikimediaFile = "Henley_beach_in_Adelaide_from_the_beach.jpg"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Henley_beach_in_Adelaide_from_the_beach.jpg"
    Notes = "Open-source locality image. Verify licence and attribution before public launch."
  },
  @{
    Club = "Moana Surf Life Saving Club"
    FileName = "moana-surf-life-saving-club.jpg"
    WikimediaFile = "Moana-Beach-0851.jpg"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Moana-Beach-0851.jpg"
    Notes = "Open-source locality image. Verify licence and attribution before public launch."
  },
  @{
    Club = "Murray Bridge Life Saving Club"
    FileName = "murray-bridge-life-saving-club.jpg"
    WikimediaFile = "Murray_Bridge_-_paddle_steamer_under_bridge(GN14105).jpg"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Murray_Bridge_-_paddle_steamer_under_bridge(GN14105).jpg"
    Notes = "Open-source Murray Bridge locality image. Not a club image."
  },
  @{
    Club = "Normanville Surf Life Saving Club"
    FileName = "normanville-surf-life-saving-club.jpg"
    WikimediaFile = "Normanville_coastline.JPG"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Normanville_coastline.JPG"
    Notes = "Open-source locality image. Verify licence and attribution before public launch."
  },
  @{
    Club = "North Haven Surf Life Saving Club"
    FileName = "north-haven-surf-life-saving-club.jpg"
    WikimediaFile = "Semaphore_(beach_area)(GN14533).jpg"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Semaphore_(beach_area)(GN14533).jpg"
    Notes = "Temporary north-western Adelaide coast image. Replace with North Haven club-approved image when available."
  },
  @{
    Club = "Port Elliot Surf Life Saving Club"
    FileName = "port-elliot-surf-life-saving-club.jpg"
    WikimediaFile = "Horseshoe_Bay_panorama.jpg"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Horseshoe_Bay_panorama.jpg"
    Notes = "Open-source locality image. Verify licence and attribution before public launch."
  },
  @{
    Club = "Port Noarlunga Surf Life Saving Club"
    FileName = "port-noarlunga-surf-life-saving-club.jpg"
    WikimediaFile = "Port_Noarlunga_-_South_Australia_(15324590967).jpg"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Port_Noarlunga_-_South_Australia_(15324590967).jpg"
    Notes = "Open-source locality image. Verify licence and attribution before public launch."
  },
  @{
    Club = "Robe Surf Life Saving Club"
    FileName = "robe-surf-life-saving-club.jpg"
    WikimediaFile = "Town_Beach,_Robe_20230214_1.jpg"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Town_Beach,_Robe_20230214_1.jpg"
    Notes = "Open-source locality image. Verify licence and attribution before public launch."
  },
  @{
    Club = "Seacliff Surf Life Saving Club"
    FileName = "seacliff-surf-life-saving-club.jpg"
    WikimediaFile = "Brighton_Beach,_South_Australia.jpg"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Brighton_Beach,_South_Australia.jpg"
    Notes = "Temporary nearby coast image. Replace with Seacliff club-approved image when available."
  },
  @{
    Club = "Semaphore Surf Life Saving Club"
    FileName = "semaphore-surf-life-saving-club.jpg"
    WikimediaFile = "Semaphore_(beach_area)(GN14533).jpg"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Semaphore_(beach_area)(GN14533).jpg"
    Notes = "Open-source locality image. Verify licence and attribution before public launch."
  },
  @{
    Club = "Somerton Surf Life Saving Club"
    FileName = "somerton-surf-life-saving-club.jpg"
    WikimediaFile = "Brighton_Beach,_South_Australia.jpg"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Brighton_Beach,_South_Australia.jpg"
    Notes = "Temporary nearby coast image. Replace with Somerton club-approved image when available."
  },
  @{
    Club = "South Port Surf Life Saving Club"
    FileName = "south-port-surf-life-saving-club.jpg"
    WikimediaFile = "Southport_(130304327).jpeg"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Southport_(130304327).jpeg"
    Notes = "Open-source locality image. Verify licence and attribution before public launch."
  },
  @{
    Club = "West Beach Surf Life Saving Club"
    FileName = "west-beach-surf-life-saving-club.jpg"
    WikimediaFile = "Adelaide_-_Glenelg_Beach_(4158746916).jpg"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Adelaide_-_Glenelg_Beach_(4158746916).jpg"
    Notes = "Temporary nearby Adelaide coast image. Replace with West Beach club-approved image when available."
  },
  @{
    Club = "Whyalla Surf Life Saving Club"
    FileName = "whyalla-surf-life-saving-club.jpg"
    WikimediaFile = "Whyalla_-_Whyalla_foreshore(GN15264).jpg"
    SourcePage = "https://commons.wikimedia.org/wiki/File:Whyalla_-_Whyalla_foreshore(GN15264).jpg"
    Notes = "Open-source locality image. Verify licence and attribution before public launch."
  }
)

function Invoke-WebRequestWithRetry {
  param (
    [string]$Uri,
    [string]$OutFile
  )

  $attempt = 1

  while ($attempt -le 4) {
    try {
      Invoke-WebRequest `
        -Uri $Uri `
        -OutFile $OutFile `
        -MaximumRedirection 10 `
        -Headers @{ "User-Agent" = "Join-Surf-Life-Saving-SA-prototype/1.0 cal@surflifesavingsa.com.au" }

      return $true
    }
    catch {
      $message = $_.Exception.Message

      if ($message -match "429" -and $attempt -lt 4) {
        Write-Warning "Rate limited. Waiting $RetryDelaySeconds seconds before retry $($attempt + 1)..."
        Start-Sleep -Seconds $RetryDelaySeconds
        $attempt++
        continue
      }

      Write-Warning "Failed: $message"
      return $false
    }
  }

  return $false
}

function Invoke-RestMethodWithRetry {
  param (
    [string]$Uri
  )

  $attempt = 1

  while ($attempt -le 4) {
    try {
      return Invoke-RestMethod `
        -Uri $Uri `
        -MaximumRedirection 10 `
        -Headers @{ "User-Agent" = "Join-Surf-Life-Saving-SA-prototype/1.0 cal@surflifesavingsa.com.au" }
    }
    catch {
      $message = $_.Exception.Message

      if ($message -match "429" -and $attempt -lt 4) {
        Write-Warning "Rate limited. Waiting $RetryDelaySeconds seconds before retry $($attempt + 1)..."
        Start-Sleep -Seconds $RetryDelaySeconds
        $attempt++
        continue
      }

      Write-Warning "Failed API lookup: $message"
      return $null
    }
  }

  return $null
}

$sourceRows = @()

foreach ($image in $images) {
  $outputPath = Join-Path $ImageFolder $image.FileName

  if (Test-Path $outputPath) {
    Write-Host "Skipping existing $($image.FileName)"

    $sourceRows += [pscustomobject]@{
      Club = $image.Club
      FileName = $image.FileName
      Status = "Already exists"
      SourcePage = $image.SourcePage
      WikimediaFile = $image.WikimediaFile
      DownloadUrl = ""
      Notes = $image.Notes
    }

    continue
  }

  Write-Host "Looking up thumbnail for $($image.Club)"

  $title = "File:$($image.WikimediaFile)"
  $encodedTitle = [uri]::EscapeDataString($title)
  $apiUrl = "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url%7Cmime%7Cextmetadata&iiurlwidth=$ThumbnailWidth&titles=$encodedTitle"

  $lookup = Invoke-RestMethodWithRetry -Uri $apiUrl

  if ($null -eq $lookup) {
    $status = "Failed API lookup"
    $downloadUrl = ""
  }
  else {
    $page = $lookup.query.pages.PSObject.Properties.Value | Select-Object -First 1

    if ($null -eq $page.imageinfo) {
      Write-Warning "No imageinfo returned for $($image.WikimediaFile)"
      $status = "No imageinfo"
      $downloadUrl = ""
    }
    else {
      $imageInfo = $page.imageinfo[0]
      $downloadUrl = $imageInfo.thumburl

      if ([string]::IsNullOrWhiteSpace($downloadUrl)) {
        $downloadUrl = $imageInfo.url
      }

      Write-Host "Downloading $($image.FileName)"
      $downloaded = Invoke-WebRequestWithRetry -Uri $downloadUrl -OutFile $outputPath
      $status = if ($downloaded) { "Downloaded" } else { "Failed download" }
    }
  }

  $sourceRows += [pscustomobject]@{
    Club = $image.Club
    FileName = $image.FileName
    Status = $status
    SourcePage = $image.SourcePage
    WikimediaFile = $image.WikimediaFile
    DownloadUrl = $downloadUrl
    Notes = $image.Notes
  }

  Start-Sleep -Seconds $RequestDelaySeconds
}

$sourceRows | Export-Csv -Path $SourceCsv -NoTypeInformation -Encoding UTF8

Write-Host ""
Write-Host "Done. Image source register written to $SourceCsv"
Write-Host "Review image licences and attribution before public launch."