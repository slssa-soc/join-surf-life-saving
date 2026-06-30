$ErrorActionPreference = "Stop"

$DataFolder = "_data"
$OutputFile = "_data\locations.json"

New-Item -ItemType Directory -Force $DataFolder | Out-Null

$locations = @(
  # Club locations
  @{ suburb = "Aldinga Beach"; postcode = "5173"; latitude = -35.2776; longitude = 138.4446 },
  @{ suburb = "Beachport"; postcode = "5280"; latitude = -37.4792; longitude = 140.0124 },
  @{ suburb = "Brighton"; postcode = "5048"; latitude = -35.0195; longitude = 138.5112 },
  @{ suburb = "Hayborough"; postcode = "5211"; latitude = -35.5268; longitude = 138.6771 },
  @{ suburb = "Christies Beach"; postcode = "5165"; latitude = -35.1372; longitude = 138.4717 },
  @{ suburb = "Elizabeth"; postcode = "5112"; latitude = -34.7197; longitude = 138.6686 },
  @{ suburb = "Glenelg"; postcode = "5045"; latitude = -34.9806; longitude = 138.5091 },
  @{ suburb = "Goolwa Beach"; postcode = "5214"; latitude = -35.5180; longitude = 138.7816 },
  @{ suburb = "Grange"; postcode = "5022"; latitude = -34.9028; longitude = 138.4894 },
  @{ suburb = "Henley Beach"; postcode = "5022"; latitude = -34.9207; longitude = 138.4945 },
  @{ suburb = "Moana"; postcode = "5169"; latitude = -35.1977; longitude = 138.4690 },
  @{ suburb = "Murray Bridge"; postcode = "5253"; latitude = -35.1199; longitude = 139.2738 },
  @{ suburb = "Normanville"; postcode = "5204"; latitude = -35.4473; longitude = 138.3150 },
  @{ suburb = "North Haven"; postcode = "5018"; latitude = -34.7879; longitude = 138.4897 },
  @{ suburb = "Port Elliot"; postcode = "5212"; latitude = -35.5324; longitude = 138.6842 },
  @{ suburb = "Port Noarlunga"; postcode = "5167"; latitude = -35.1496; longitude = 138.4672 },
  @{ suburb = "Port Noarlunga South"; postcode = "5167"; latitude = -35.1595; longitude = 138.4669 },
  @{ suburb = "Robe"; postcode = "5276"; latitude = -37.1646; longitude = 139.7606 },
  @{ suburb = "Seacliff"; postcode = "5049"; latitude = -35.0342; longitude = 138.5133 },
  @{ suburb = "Semaphore Park"; postcode = "5019"; latitude = -34.8515; longitude = 138.4775 },
  @{ suburb = "Somerton Park"; postcode = "5044"; latitude = -34.9980; longitude = 138.5143 },
  @{ suburb = "West Beach"; postcode = "5024"; latitude = -34.9466; longitude = 138.5025 },
  @{ suburb = "Whyalla"; postcode = "5600"; latitude = -33.0338; longitude = 137.5841 },

  # Adelaide CBD and inner suburbs
  @{ suburb = "Adelaide"; postcode = "5000"; latitude = -34.9285; longitude = 138.6007 },
  @{ suburb = "North Adelaide"; postcode = "5006"; latitude = -34.9077; longitude = 138.5960 },
  @{ suburb = "Norwood"; postcode = "5067"; latitude = -34.9219; longitude = 138.6277 },
  @{ suburb = "Unley"; postcode = "5061"; latitude = -34.9508; longitude = 138.6070 },
  @{ suburb = "Mitcham"; postcode = "5062"; latitude = -34.9782; longitude = 138.6220 },
  @{ suburb = "Burnside"; postcode = "5066"; latitude = -34.9362; longitude = 138.6590 },
  @{ suburb = "Prospect"; postcode = "5082"; latitude = -34.8845; longitude = 138.5933 },
  @{ suburb = "Walkerville"; postcode = "5081"; latitude = -34.8946; longitude = 138.6169 },
  @{ suburb = "Goodwood"; postcode = "5034"; latitude = -34.9500; longitude = 138.5908 },
  @{ suburb = "Mile End"; postcode = "5031"; latitude = -34.9283; longitude = 138.5700 },
  @{ suburb = "Plympton"; postcode = "5038"; latitude = -34.9630; longitude = 138.5550 },

  # Western suburbs and coast
  @{ suburb = "Glenelg North"; postcode = "5045"; latitude = -34.9684; longitude = 138.5132 },
  @{ suburb = "Glenelg South"; postcode = "5045"; latitude = -34.9909; longitude = 138.5130 },
  @{ suburb = "Hove"; postcode = "5048"; latitude = -35.0085; longitude = 138.5208 },
  @{ suburb = "Kingston Park"; postcode = "5049"; latitude = -35.0390; longitude = 138.5162 },
  @{ suburb = "Marino"; postcode = "5049"; latitude = -35.0435; longitude = 138.5120 },
  @{ suburb = "Henley Beach South"; postcode = "5022"; latitude = -34.9362; longitude = 138.4982 },
  @{ suburb = "Fulham"; postcode = "5024"; latitude = -34.9275; longitude = 138.5131 },
  @{ suburb = "Fulham Gardens"; postcode = "5024"; latitude = -34.9148; longitude = 138.5143 },
  @{ suburb = "Seaton"; postcode = "5023"; latitude = -34.8992; longitude = 138.5165 },
  @{ suburb = "West Lakes"; postcode = "5021"; latitude = -34.8727; longitude = 138.4915 },
  @{ suburb = "Tennyson"; postcode = "5022"; latitude = -34.8860; longitude = 138.4851 },
  @{ suburb = "Semaphore"; postcode = "5019"; latitude = -34.8397; longitude = 138.4823 },
  @{ suburb = "Largs Bay"; postcode = "5016"; latitude = -34.8248; longitude = 138.4861 },
  @{ suburb = "Taperoo"; postcode = "5017"; latitude = -34.8047; longitude = 138.4942 },
  @{ suburb = "Osborne"; postcode = "5017"; latitude = -34.7986; longitude = 138.4977 },
  @{ suburb = "Port Adelaide"; postcode = "5015"; latitude = -34.8464; longitude = 138.5038 },
  @{ suburb = "Outer Harbor"; postcode = "5018"; latitude = -34.7794; longitude = 138.4852 },

  # Northern suburbs
  @{ suburb = "Salisbury"; postcode = "5108"; latitude = -34.7623; longitude = 138.6480 },
  @{ suburb = "Mawson Lakes"; postcode = "5095"; latitude = -34.8147; longitude = 138.6203 },
  @{ suburb = "Parafield Gardens"; postcode = "5107"; latitude = -34.7934; longitude = 138.6124 },
  @{ suburb = "Golden Grove"; postcode = "5125"; latitude = -34.7836; longitude = 138.7246 },
  @{ suburb = "Modbury"; postcode = "5092"; latitude = -34.8337; longitude = 138.6897 },
  @{ suburb = "Tea Tree Gully"; postcode = "5091"; latitude = -34.8211; longitude = 138.7312 },
  @{ suburb = "Gawler"; postcode = "5118"; latitude = -34.5995; longitude = 138.7490 },
  @{ suburb = "Munno Para"; postcode = "5115"; latitude = -34.6680; longitude = 138.7010 },

  # Southern suburbs and Onkaparinga
  @{ suburb = "Marion"; postcode = "5043"; latitude = -35.0024; longitude = 138.5531 },
  @{ suburb = "Hallett Cove"; postcode = "5158"; latitude = -35.0745; longitude = 138.5103 },
  @{ suburb = "O'Halloran Hill"; postcode = "5158"; latitude = -35.0678; longitude = 138.5552 },
  @{ suburb = "Aberfoyle Park"; postcode = "5159"; latitude = -35.0767; longitude = 138.5915 },
  @{ suburb = "Morphett Vale"; postcode = "5162"; latitude = -35.1213; longitude = 138.5237 },
  @{ suburb = "Noarlunga Centre"; postcode = "5168"; latitude = -35.1419; longitude = 138.4967 },
  @{ suburb = "Old Noarlunga"; postcode = "5168"; latitude = -35.1827; longitude = 138.4994 },
  @{ suburb = "Seaford"; postcode = "5169"; latitude = -35.1884; longitude = 138.4754 },
  @{ suburb = "Seaford Rise"; postcode = "5169"; latitude = -35.1937; longitude = 138.4889 },
  @{ suburb = "Maslin Beach"; postcode = "5170"; latitude = -35.2283; longitude = 138.4697 },
  @{ suburb = "Port Willunga"; postcode = "5173"; latitude = -35.2617; longitude = 138.4575 },
  @{ suburb = "Sellicks Beach"; postcode = "5174"; latitude = -35.3323; longitude = 138.4472 },
  @{ suburb = "Willunga"; postcode = "5172"; latitude = -35.2714; longitude = 138.5546 },
  @{ suburb = "McLaren Vale"; postcode = "5171"; latitude = -35.2180; longitude = 138.5434 },

  # Hills
  @{ suburb = "Mount Barker"; postcode = "5251"; latitude = -35.0667; longitude = 138.8580 },
  @{ suburb = "Hahndorf"; postcode = "5245"; latitude = -35.0300; longitude = 138.8109 },
  @{ suburb = "Stirling"; postcode = "5152"; latitude = -35.0060; longitude = 138.7160 },
  @{ suburb = "Crafers"; postcode = "5152"; latitude = -34.9970; longitude = 138.7040 },
  @{ suburb = "Aldgate"; postcode = "5154"; latitude = -35.0161; longitude = 138.7355 },
  @{ suburb = "Strathalbyn"; postcode = "5255"; latitude = -35.2596; longitude = 138.8924 },

  # Fleurieu and Victor Harbor area
  @{ suburb = "Victor Harbor"; postcode = "5211"; latitude = -35.5502; longitude = 138.6217 },
  @{ suburb = "Encounter Bay"; postcode = "5211"; latitude = -35.5742; longitude = 138.5964 },
  @{ suburb = "Middleton"; postcode = "5213"; latitude = -35.5102; longitude = 138.7034 },
  @{ suburb = "Goolwa"; postcode = "5214"; latitude = -35.5010; longitude = 138.7845 },
  @{ suburb = "Goolwa South"; postcode = "5214"; latitude = -35.5131; longitude = 138.7856 },
  @{ suburb = "Hindmarsh Island"; postcode = "5214"; latitude = -35.5089; longitude = 138.8676 },
  @{ suburb = "Yankalilla"; postcode = "5203"; latitude = -35.4572; longitude = 138.3496 },
  @{ suburb = "Carrickalinga"; postcode = "5204"; latitude = -35.4230; longitude = 138.3284 },
  @{ suburb = "Second Valley"; postcode = "5204"; latitude = -35.5120; longitude = 138.2184 },
  @{ suburb = "Rapid Bay"; postcode = "5204"; latitude = -35.5244; longitude = 138.1926 },
  @{ suburb = "Cape Jervis"; postcode = "5204"; latitude = -35.6048; longitude = 138.0969 },

  # Limestone Coast and South East
  @{ suburb = "Mount Gambier"; postcode = "5290"; latitude = -37.8284; longitude = 140.7804 },
  @{ suburb = "Millicent"; postcode = "5280"; latitude = -37.5936; longitude = 140.3549 },
  @{ suburb = "Naracoorte"; postcode = "5271"; latitude = -36.9579; longitude = 140.7423 },
  @{ suburb = "Kingston SE"; postcode = "5275"; latitude = -36.8309; longitude = 139.8525 },
  @{ suburb = "Penola"; postcode = "5277"; latitude = -37.3783; longitude = 140.8377 },
  @{ suburb = "Port MacDonnell"; postcode = "5291"; latitude = -38.0536; longitude = 140.6996 },

  # Regional centres
  @{ suburb = "Port Lincoln"; postcode = "5606"; latitude = -34.7208; longitude = 135.8580 },
  @{ suburb = "Port Augusta"; postcode = "5700"; latitude = -32.4952; longitude = 137.7894 },
  @{ suburb = "Port Pirie"; postcode = "5540"; latitude = -33.1771; longitude = 138.0089 },
  @{ suburb = "Kadina"; postcode = "5554"; latitude = -33.9640; longitude = 137.7160 },
  @{ suburb = "Wallaroo"; postcode = "5556"; latitude = -33.9320; longitude = 137.6270 },
  @{ suburb = "Moonta"; postcode = "5558"; latitude = -34.0690; longitude = 137.5918 },
  @{ suburb = "Clare"; postcode = "5453"; latitude = -33.8333; longitude = 138.6100 },
  @{ suburb = "Barossa Valley"; postcode = ""; latitude = -34.5333; longitude = 138.9500 },
  @{ suburb = "Tanunda"; postcode = "5352"; latitude = -34.5236; longitude = 138.9598 },
  @{ suburb = "Nuriootpa"; postcode = "5355"; latitude = -34.4683; longitude = 138.9944 },
  @{ suburb = "Renmark"; postcode = "5341"; latitude = -34.1770; longitude = 140.7460 },
  @{ suburb = "Berri"; postcode = "5343"; latitude = -34.2814; longitude = 140.5998 },
  @{ suburb = "Loxton"; postcode = "5333"; latitude = -34.4517; longitude = 140.5691 },
  @{ suburb = "Waikerie"; postcode = "5330"; latitude = -34.1816; longitude = 139.9854 },
  @{ suburb = "Victor Harbor Area"; postcode = ""; latitude = -35.5502; longitude = 138.6217 },
  @{ suburb = "Fleurieu Peninsula"; postcode = ""; latitude = -35.3800; longitude = 138.5500 },
  @{ suburb = "Limestone Coast"; postcode = ""; latitude = -37.3000; longitude = 140.5000 },
  @{ suburb = "Murraylands"; postcode = ""; latitude = -35.1200; longitude = 139.2800 },
  @{ suburb = "Adelaide Hills"; postcode = ""; latitude = -35.0000; longitude = 138.7500 },
  @{ suburb = "Northern Adelaide"; postcode = ""; latitude = -34.7300; longitude = 138.6700 },
  @{ suburb = "Southern Adelaide"; postcode = ""; latitude = -35.1200; longitude = 138.5200 },
  @{ suburb = "Western Adelaide"; postcode = ""; latitude = -34.9200; longitude = 138.5000 }
)

$normalised = $locations |
  Sort-Object suburb, postcode -Unique |
  ForEach-Object {
    $postcodePart = if ([string]::IsNullOrWhiteSpace($_.postcode)) { "" } else { " $($_.postcode)" }

    [pscustomobject]@{
      suburb = $_.suburb
      postcode = $_.postcode
      label = "$($_.suburb), SA$postcodePart"
      latitude = $_.latitude
      longitude = $_.longitude
    }
  }

$json = $normalised | ConvertTo-Json -Depth 5
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Resolve-Path $DataFolder).Path + "\locations.json", $json, $utf8NoBom)

Write-Host "Wrote $($normalised.Count) locations to $OutputFile"