$ErrorActionPreference = "Stop"

$ClubFolder = "_clubs"
New-Item -ItemType Directory -Force $ClubFolder | Out-Null

$utf8NoBom = New-Object System.Text.UTF8Encoding $false

function Quote-Yaml {
  param([string]$Value)

  if ($null -eq $Value) {
    return "''"
  }

  return "'" + ($Value -replace "'", "''") + "'"
}

function Write-YamlList {
  param([array]$Items)

  if ($null -eq $Items -or $Items.Count -eq 0) {
    return "  - 'Confirm with club'"
  }

  return ($Items | ForEach-Object { "  - " + (Quote-Yaml $_) }) -join "`n"
}

function Write-MarkdownList {
  param([array]$Items)

  if ($null -eq $Items -or $Items.Count -eq 0) {
    return "- Confirm with the club."
  }

  return ($Items | ForEach-Object { "- $_" }) -join "`n"
}

function Write-ClubFile {
  param(
    [hashtable]$Club
  )

  $filePath = Join-Path $ClubFolder $Club.FileName

  $ageGroups = Write-YamlList $Club.AgeGroups
  $interests = Write-YamlList $Club.Interests
  $facilities = Write-YamlList $Club.Facilities
  $verifiedPrograms = Write-YamlList $Club.VerifiedPrograms
  $bestFor = Write-YamlList $Club.BestFor

  $offerings = Write-MarkdownList $Club.Offerings
  $training = Write-MarkdownList $Club.Training
  $fees = Write-MarkdownList $Club.Fees
  $culture = Write-MarkdownList $Club.Culture
  $decision = Write-MarkdownList $Club.DecisionNotes
  $sources = Write-MarkdownList $Club.Sources

  $content = @"
---
layout: club
title: $(Quote-Yaml $Club.Title)
slug: $(Quote-Yaml $Club.Slug)
permalink: $(Quote-Yaml "/clubs/$($Club.Slug)/")
summary: $(Quote-Yaml $Club.Summary)
image: $(Quote-Yaml "/assets/img/clubs/$($Club.ImageFile)")
suburb: $(Quote-Yaml $Club.Suburb)
region: $(Quote-Yaml $Club.Region)
address: $(Quote-Yaml $Club.Address)
website: $(Quote-Yaml $Club.Website)
latitude: $($Club.Latitude)
longitude: $($Club.Longitude)
member_size: $(Quote-Yaml $Club.MemberSize)
membership_fee_note: $(Quote-Yaml $Club.MembershipFeeNote)
membership_fee_source: $(Quote-Yaml $Club.MembershipFeeSource)
source_checked: '2026-06-30'
age_groups:
$ageGroups
interests:
$interests
facilities:
$facilities
verified_programs:
$verifiedPrograms
best_for:
$bestFor
commitment:
  id: $(Quote-Yaml $Club.CommitmentId)
  label: $(Quote-Yaml $Club.CommitmentLabel)
adaptive_program: $(Quote-Yaml $Club.AdaptiveProgram)
multicultural_program: $(Quote-Yaml $Club.MulticulturalProgram)
gym_facilities: $(Quote-Yaml $Club.GymFacilities)
family_friendly: $(Quote-Yaml $Club.FamilyFriendly)
badge_label: $(Quote-Yaml $Club.BadgeLabel)
badge_type: $(Quote-Yaml $Club.BadgeType)
---

## Overview

$($Club.Overview)

## What this club offers

$offerings

## Training, Nippers and member activity

$training

## Membership fees and joining notes

$fees

## Culture and club fit

$culture

## Who this club may suit

$decision

## Profile sources and review notes

$sources

This profile is intended to help prospective members compare clubs. Details such as fees, training times, program availability and facilities should be confirmed with the club before public launch.
"@

  [System.IO.File]::WriteAllText((Resolve-Path $ClubFolder).Path + "\" + $Club.FileName, $content, $utf8NoBom)
}

$commonSurfInterests = @("lifesaving-patrols", "nippers", "surf-sports", "training", "volunteering", "community")
$commonSurfFacilities = @("beach-access", "clubrooms", "family-friendly", "training")
$commonSurfAges = @("nippers", "youth", "adults", "families")

$clubs = @(
  @{
    FileName = "aldinga-bay-surf-life-saving-club.md"
    Title = "Aldinga Bay Surf Life Saving Club"
    Slug = "aldinga-bay-surf-life-saving-club"
    Summary = "A southern coastal club serving Aldinga Beach, with patrols, Nippers, Seahorses, training and community volunteering."
    ImageFile = "aldinga-bay-surf-life-saving-club.jpg"
    Suburb = "Aldinga Beach"
    Region = "Fleurieu and South Metro"
    Address = "Norman Road, Aldinga Beach SA 5173"
    Website = "https://aldingabaysurflifesavingclub.com/"
    Latitude = "-35.2776"
    Longitude = "138.4446"
    MemberSize = "Small to medium coastal club"
    MembershipFeeNote = "Seahorses fee publicly listed as $150 per Seahorse and parent/guardian inclusive. Nipper and general membership fees should be confirmed with the club."
    MembershipFeeSource = "https://aldingabaysurflifesavingclub.com/wp-content/uploads/2025/10/Seahorse-info-and-FAQs-booklet.pdf"
    AgeGroups = $commonSurfAges
    Interests = $commonSurfInterests + @("inclusive-programs")
    Facilities = $commonSurfFacilities
    VerifiedPrograms = @("Nippers", "Seahorses inclusive program", "Beach patrols", "Surf safety", "First aid", "Volunteer lifesaving")
    BestFor = @("Families in the southern suburbs", "Children starting beach safety", "People looking for a smaller community club", "Members interested in inclusive junior participation")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Seahorses inclusive program"
    MulticulturalProgram = "Ask club"
    GymFacilities = "Ask club"
    FamilyFriendly = "Yes"
    BadgeLabel = "Inclusive junior program"
    BadgeType = "community"
    Overview = "Aldinga Bay SLSC describes itself as a small volunteer organisation on the Fleurieu Peninsula, around 50 km south of Adelaide. The club provides rescue services on its stretch of coastline, patrols on weekends and public holidays during the summer season, and can support emergency out-of-hours callouts."
    Offerings = @(
      "Beach patrols during the summer season.",
      "Nippers program with beach sprints, flags, ocean swimming, boards, surf safety, sun safety and first aid activities.",
      "Seahorses inclusive junior program for children who benefit from an adapted pathway.",
      "Volunteer roles for lifesaving, water safety, junior support and club operations."
    )
    Training = @(
      "Nippers information is published by the club each season.",
      "The 2025/26 Seahorses booklet lists program cost and Sports Voucher information.",
      "Patrol and lifesaving training details should be confirmed with the club."
    )
    Fees = @(
      "Seahorses: publicly listed as $150 per Seahorse and parent/guardian inclusive.",
      "Sports Vouchers are referenced in the Seahorses information.",
      "Nipper and general membership fees were not clearly verified from the public site in this pass."
    )
    Culture = @(
      "Good fit for families wanting a community-scale southern beach club.",
      "The public materials emphasise junior learning, beach safety and inclusion.",
      "Likely to suit members who want practical volunteering and a local beach community."
    )
    DecisionNotes = @(
      "Choose Aldinga Bay if you are near Aldinga Beach or the southern Fleurieu edge.",
      "Strong candidate for families looking for Nippers or Seahorses.",
      "Confirm current training days and fees directly with the club before joining."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://aldingabaysurflifesavingclub.com/",
      "Juniors page: https://aldingabaysurflifesavingclub.com/juniors/",
      "Seahorses booklet: https://aldingabaysurflifesavingclub.com/wp-content/uploads/2025/10/Seahorse-info-and-FAQs-booklet.pdf"
    )
  },
  @{
    FileName = "beachport-surf-life-saving-club.md"
    Title = "Beachport Surf Life Saving Club"
    Slug = "beachport-surf-life-saving-club"
    Summary = "A regional Limestone Coast club supporting the Beachport community through lifesaving, training and volunteering."
    ImageFile = "beachport-surf-life-saving-club.jpg"
    Suburb = "Beachport"
    Region = "Limestone Coast"
    Address = "Millicent Road, Beachport SA 5280"
    Website = "https://beachportslsc.com.au/"
    Latitude = "-37.4792"
    Longitude = "140.0124"
    MemberSize = "Regional club"
    MembershipFeeNote = "Current public membership fees not verified in this pass. Confirm with club."
    MembershipFeeSource = ""
    AgeGroups = @("youth", "adults", "families")
    Interests = @("lifesaving-patrols", "training", "volunteering", "community")
    Facilities = @("beach-access", "clubrooms", "family-friendly")
    VerifiedPrograms = @("Regional lifesaving", "Volunteer patrols", "Community water safety")
    BestFor = @("Limestone Coast families", "Regional volunteers", "People interested in community coastal safety")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Ask club"
    MulticulturalProgram = "Ask club"
    GymFacilities = "Ask club"
    FamilyFriendly = "Yes"
    BadgeLabel = "Regional club"
    BadgeType = "community"
    Overview = "Beachport SLSC is the Limestone Coast surf life saving club listed by SLSSA for the Beachport community. It is best positioned for people living in or visiting the lower South East who want to participate in lifesaving or support regional coastal safety."
    Offerings = @(
      "Regional surf life saving and beach safety participation.",
      "Volunteer roles around lifesaving, training, club operations and events.",
      "Community connection for members in the Beachport area."
    )
    Training = @(
      "Training and program days should be confirmed with the club.",
      "Prospective members should use the club website or SLSSA directory link to enquire."
    )
    Fees = @(
      "Current fees were not clearly verified from public search results in this pass.",
      "Profile should be updated once the club confirms current membership categories and costs."
    )
    Culture = @(
      "Regional club environment.",
      "Likely to suit members who prefer a smaller community-based club rather than a large metropolitan club."
    )
    DecisionNotes = @(
      "Choose Beachport if you are based on the Limestone Coast or want a regional club environment.",
      "Confirm Nippers availability, training days and membership costs directly with the club."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://beachportslsc.com.au/"
    )
  },
  @{
    FileName = "brighton-surf-life-saving-club.md"
    Title = "Brighton Surf Life Saving Club"
    Slug = "brighton-surf-life-saving-club"
    Summary = "A large metropolitan club on the Brighton foreshore, offering Nippers, lifesaving, surf sports, training, volunteering and a strong family club environment."
    ImageFile = "brighton-surf-life-saving-club.jpg"
    Suburb = "Brighton"
    Region = "Adelaide Metro"
    Address = "The Esplanade, Brighton SA 5048"
    Website = "https://www.brightonsurfclub.com/"
    Latitude = "-35.0195"
    Longitude = "138.5112"
    MemberSize = "Large metro club"
    MembershipFeeNote = "Current public membership fees not clearly verified in this pass. Club website directs members through SLSA registration and club registrar."
    MembershipFeeSource = "https://www.brightonsurfclub.com/the-club/how-to-join/"
    AgeGroups = $commonSurfAges
    Interests = $commonSurfInterests
    Facilities = $commonSurfFacilities + @("hospitality")
    VerifiedPrograms = @("Nippers", "Come and Try Nippers", "Lifesaving pathways", "Surf sports", "Volunteer club roles")
    BestFor = @("Families near Brighton", "Children starting Nippers", "Members wanting a large metropolitan club", "People interested in lifesaving and surf sports")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Ask club"
    MulticulturalProgram = "Ask club"
    GymFacilities = "Ask club"
    FamilyFriendly = "Yes"
    BadgeLabel = "Large metro club"
    BadgeType = "blue"
    Overview = "Brighton SLSC presents itself as a relaxed, family-oriented surf lifesaving club and one of the larger clubs in South Australia. Its public information emphasises Nippers, lifesaving pathways, volunteering and community participation."
    Offerings = @(
      "Nippers program based on surf education, beach activities, swimming, running and board paddling.",
      "Come and Try Nippers sessions for new families.",
      "Lifesaving pathway information, including SRC and Bronze Medallion progression.",
      "Surf sports and broader volunteer club roles."
    )
    Training = @(
      "Come and Try Nippers information states families meet on the beach on Saturday at 1:30pm for a 2:00pm start.",
      "Nippers are education-focused with competition as one part of the broader program.",
      "Lifesaving pathway information is published on the club website."
    )
    Fees = @(
      "Current fee schedule was not clearly verified from the public site in this pass.",
      "The club advises new members to register through Surf Life Saving Australia and contact the Registrar for information."
    )
    Culture = @(
      "Large metropolitan club with family, lifesaving, sport and social pathways.",
      "Volunteer-based operating model.",
      "Good fit for people who want a busy club with multiple ways to participate."
    )
    DecisionNotes = @(
      "Choose Brighton if you want a large metro club with strong Nippers and multiple member pathways.",
      "Good option for families in Brighton, Hove, Marion and nearby suburbs.",
      "Confirm fees and program availability directly with the registrar before joining."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://www.brightonsurfclub.com/",
      "How to join: https://www.brightonsurfclub.com/the-club/how-to-join/",
      "Nippers: https://www.brightonsurfclub.com/nippers/",
      "Come and Try: https://www.brightonsurfclub.com/nippers/come-and-try/",
      "Membership information: https://www.brightonsurfclub.com/the-club/membership-information/"
    )
  },
  @{
    FileName = "chiton-rocks-surf-life-saving-club.md"
    Title = "Chiton Rocks Surf Life Saving Club"
    Slug = "chiton-rocks-surf-life-saving-club"
    Summary = "A Fleurieu Peninsula club at Hayborough with lifesaving patrols, Nippers, member accommodation, training and a strong community-service culture."
    ImageFile = "chiton-rocks-surf-life-saving-club.jpg"
    Suburb = "Hayborough"
    Region = "Fleurieu Peninsula"
    Address = "Hindmarsh Esplanade, Hayborough SA 5211"
    Website = "https://www.chitonrocks.com/"
    Latitude = "-35.5268"
    Longitude = "138.6771"
    MemberSize = "Medium coastal club"
    MembershipFeeNote = "Current fees not clearly verified. Older 2019/20 Nipper information listed $150 per family or $50 per person; confirm current fees with club."
    MembershipFeeSource = "https://www.chitonrocks.com/wp-content/uploads/2019/09/Chiton-Nipper-Info-2019-2020.pdf"
    AgeGroups = $commonSurfAges
    Interests = $commonSurfInterests
    Facilities = $commonSurfFacilities + @("hospitality")
    VerifiedPrograms = @("Nippers", "Beach patrols", "CPR", "First aid", "Radio operation", "Rescue techniques", "Member accommodation for contributing members")
    BestFor = @("Fleurieu families", "Members wanting a strong community-service culture", "People interested in lifesaving skills", "Members who value club accommodation benefits")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Ask club"
    MulticulturalProgram = "Ask club"
    GymFacilities = "Ask club"
    FamilyFriendly = "Yes"
    BadgeLabel = "Fleurieu community"
    BadgeType = "blue"
    Overview = "Chiton Rocks SLSC publicly describes a voluntary club providing surf life saving services to local beachgoers and visitors through the Australian summer. The club highlights community service, diverse membership, training, Nippers and family participation."
    Offerings = @(
      "Summer beach patrols.",
      "Nippers for children aged 5 to 13.",
      "Lifesaving skills including CPR, surf safety, rescue techniques, first aid, radio operation and beach patrolling.",
      "Accommodation benefits for contributing members involved in patrols or committees.",
      "Restaurant and broader club facilities."
    )
    Training = @(
      "Members train annually to maintain proficiency in first aid and rescue techniques.",
      "Nippers information is available on the club website.",
      "Club social events, surf carnival dates and Nipper activities are communicated through club newsletters/calendar."
    )
    Fees = @(
      "Current fees should be confirmed with the club.",
      "Older 2019/20 Nipper information listed $150 per family or $50 per person, but this should not be treated as current."
    )
    Culture = @(
      "Strong community-service culture.",
      "Family membership growth and a vibrant junior development program are highlighted on the club website.",
      "Members travel from other parts of the state to contribute to beach safety."
    )
    DecisionNotes = @(
      "Choose Chiton Rocks if you are around Victor Harbor, Hayborough or the Fleurieu and want a community-oriented club.",
      "Good fit for families looking for Nippers and people wanting patrol and first aid skills.",
      "Confirm current fees, patrol expectations and Nipper times before joining."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://www.chitonrocks.com/",
      "Membership: https://www.chitonrocks.com/membership/",
      "Nippers: https://www.chitonrocks.com/nippers/",
      "Contact: https://www.chitonrocks.com/about/contact-us/",
      "Accommodation: https://www.chitonrocks.com/accommodation/"
    )
  },
  @{
    FileName = "christies-beach-surf-life-saving-club.md"
    Title = "Christies Beach Surf Life Saving Club"
    Slug = "christies-beach-surf-life-saving-club"
    Summary = "A southern metropolitan club serving Christies Beach, with pathways into lifesaving patrols, Nippers, training, surf sports and volunteering."
    ImageFile = "christies-beach-surf-life-saving-club.jpg"
    Suburb = "Christies Beach"
    Region = "South Metro"
    Address = "Esplanade, Christies Beach SA 5165"
    Website = "https://www.christiesbeachslsc.com.au/"
    Latitude = "-35.1372"
    Longitude = "138.4717"
    MemberSize = "Medium metro club"
    MembershipFeeNote = "Current public membership fees not verified in this pass. Confirm with club."
    MembershipFeeSource = ""
    AgeGroups = $commonSurfAges
    Interests = $commonSurfInterests
    Facilities = $commonSurfFacilities
    VerifiedPrograms = @("Nippers", "Lifesaving patrols", "Training", "Surf sports", "Community volunteering")
    BestFor = @("Families in the mid-south coast", "People near Christies Beach", "Members wanting a southern metro surf club")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Ask club"
    MulticulturalProgram = "Ask club"
    GymFacilities = "Ask club"
    FamilyFriendly = "Yes"
    BadgeLabel = "Southern metro"
    BadgeType = "blue"
    Overview = "Christies Beach SLSC is listed by SLSSA as the surf life saving club for Christies Beach. It is a practical option for people in the southern metropolitan area who want local beach patrol, junior, sport or volunteer pathways."
    Offerings = @(
      "Surf life saving participation at Christies Beach.",
      "Likely pathways include patrols, Nippers, surf sports, training and general club volunteering.",
      "Local community participation in the southern metropolitan coastline."
    )
    Training = @(
      "Training days and Nipper session times should be confirmed with the club.",
      "Use the club website or contact details from the SLSSA directory for current information."
    )
    Fees = @(
      "Current public fee schedule was not verified in this pass.",
      "Profile should be updated once the club confirms current categories and costs."
    )
    Culture = @(
      "Southern metropolitan community club.",
      "Likely to suit people who want a local beach club rather than a large central metropolitan club."
    )
    DecisionNotes = @(
      "Choose Christies Beach if it is your closest southern metro club.",
      "Confirm Nippers, training nights, facilities and fees directly with the club."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://www.christiesbeachslsc.com.au/"
    )
  },
  @{
    FileName = "elizabeth-life-saving-club.md"
    Title = "Elizabeth Life Saving Club"
    Slug = "elizabeth-life-saving-club"
    Summary = "A northern Adelaide life saving club focused on water safety, swimming, training and lifesaving participation away from the surf beach environment."
    ImageFile = "elizabeth-life-saving-club.jpg"
    Suburb = "Elizabeth"
    Region = "Northern Adelaide"
    Address = "Elizabeth Aquadome, Crockerton Road, Elizabeth SA 5112"
    Website = "https://elizabethlifesavingclub.org/"
    Latitude = "-34.7197"
    Longitude = "138.6686"
    MemberSize = "Community life saving club"
    MembershipFeeNote = "Current public membership fees not verified in this pass. Confirm with club."
    MembershipFeeSource = ""
    AgeGroups = @("youth", "adults", "families")
    Interests = @("training", "volunteering", "community", "water-safety")
    Facilities = @("clubrooms", "family-friendly", "training")
    VerifiedPrograms = @("Water safety", "Swimming and lifesaving skills", "Community volunteering")
    BestFor = @("Northern Adelaide families", "People seeking a non-beach lifesaving pathway", "Members interested in water safety and swimming skills")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Ask club"
    MulticulturalProgram = "Ask club"
    GymFacilities = "No surf-club gym listed"
    FamilyFriendly = "Yes"
    BadgeLabel = "Community lifesaving"
    BadgeType = "community"
    Overview = "Elizabeth Life Saving Club is an important part of the SLSSA network. Its public history describes the club as starting in 1963 from the principle that every child has the right to be taught to swim, with lessons historically held on Saturday mornings."
    Offerings = @(
      "Water safety and swimming-focused lifesaving participation.",
      "Community-based lifesaving pathway away from the surf beach.",
      "Volunteer roles supporting local water safety."
    )
    Training = @(
      "The club history references Saturday morning lessons from 8:00am to 9:30am historically.",
      "Current program times and membership details should be confirmed with the club."
    )
    Fees = @(
      "Current public fees were not verified in this pass.",
      "Confirm directly with Elizabeth Life Saving Club."
    )
    Culture = @(
      "Strong community and water-safety education focus.",
      "Good fit for northern Adelaide families who may not live near the beach.",
      "Important inclusion in the finder because it supports the broader lifesaving movement."
    )
    DecisionNotes = @(
      "Choose Elizabeth LSC if you are in northern Adelaide and want a water-safety or swimming-oriented lifesaving pathway.",
      "Confirm current program days, age groups and costs directly with the club."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://elizabethlifesavingclub.org/",
      "Club history: https://elizabethlifesavingclub.org/the-club/",
      "Facebook: https://www.facebook.com/elizabethlifesavingclubinc/"
    )
  },
  @{
    FileName = "glenelg-surf-life-saving-club.md"
    Title = "Glenelg Surf Life Saving Club"
    Slug = "glenelg-surf-life-saving-club"
    Summary = "A prominent metropolitan club on the Glenelg foreshore, offering Nippers, lifesaving, training, patrols, surf sports and a highly visible beach community."
    ImageFile = "glenelg-surf-life-saving-club.jpg"
    Suburb = "Glenelg"
    Region = "Adelaide Metro"
    Address = "The Foreshore, Glenelg SA 5045"
    Website = "https://www.glenelgslsc.com.au/"
    Latitude = "-34.9806"
    Longitude = "138.5091"
    MemberSize = "Large metro club"
    MembershipFeeNote = "Public snippets identify a membership fees page and 2025/26 junior guide. Confirm final current fees from the club before publishing."
    MembershipFeeSource = "https://www.glenelgslsc.com.au/want-to-join/membership-fees"
    AgeGroups = $commonSurfAges
    Interests = $commonSurfInterests
    Facilities = $commonSurfFacilities + @("hospitality")
    VerifiedPrograms = @("Nippers", "Junior training", "Patrol roster", "Training and proficiencies", "Surf sports", "Club swim")
    BestFor = @("Families near Glenelg", "Members wanting a central high-profile beach club", "People interested in busy beach patrols and junior sport")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Ask club"
    MulticulturalProgram = "Ask club"
    GymFacilities = "Ask club"
    FamilyFriendly = "Yes"
    BadgeLabel = "High-profile metro club"
    BadgeType = "yellow"
    Overview = "Glenelg SLSC is located at one of Adelaide’s best-known beaches, close to the CBD and public activity around the Glenelg foreshore. Public club pages include Nippers, training and lifesaving information."
    Offerings = @(
      "Nippers and junior sport pathway.",
      "Lifesaving patrols, training and proficiencies.",
      "Surf sports and carnivals.",
      "Central metropolitan beach location with high visibility."
    )
    Training = @(
      "Public 2025/26 junior guide snippets state Saturday training from 1:30pm to 3:45pm with an all-member club swim.",
      "Club website includes training and proficiencies information.",
      "Current times should be confirmed with the club."
    )
    Fees = @(
      "A public membership fees page exists, but the site is JavaScript-rendered in search results.",
      "Public snippets identify Nipper and parent membership requirements; confirm exact 2025/26 rates with the club before publishing."
    )
    Culture = @(
      "Large, visible metropolitan club at a busy tourist and community beach.",
      "Likely suited to families and members comfortable in a busier club environment.",
      "Good option for people who want access to a wide range of lifesaving, sport and junior pathways."
    )
    DecisionNotes = @(
      "Choose Glenelg if you want a central metro club at a high-profile beach.",
      "Good fit for families interested in Nippers and surf sports.",
      "Confirm current fees and Saturday training details before joining."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://www.glenelgslsc.com.au/",
      "Want to join: https://www.glenelgslsc.com.au/want-to-join",
      "Membership fees: https://www.glenelgslsc.com.au/want-to-join/membership-fees",
      "Junior sports/training: https://www.glenelgslsc.com.au/junior-sports/training",
      "Contact: https://www.glenelgslsc.com.au/contact"
    )
  },
  @{
    FileName = "goolwa-surf-life-saving-club.md"
    Title = "Goolwa Surf Life Saving Club"
    Slug = "goolwa-surf-life-saving-club"
    Summary = "A Fleurieu Peninsula club at Goolwa Beach with Nippers, patrols, training and publicly listed membership categories."
    ImageFile = "goolwa-surf-life-saving-club.jpg"
    Suburb = "Goolwa Beach"
    Region = "Fleurieu Peninsula"
    Address = "Beach Road, Goolwa SA 5214"
    Website = "https://goolwaslsc.com.au/"
    Latitude = "-35.5180"
    Longitude = "138.7816"
    MemberSize = "Medium coastal club"
    MembershipFeeNote = "Publicly listed fees include family and active/youth categories; confirm current season rates before publishing."
    MembershipFeeSource = "https://goolwaslsc.com.au/join-us/"
    AgeGroups = $commonSurfAges
    Interests = $commonSurfInterests
    Facilities = $commonSurfFacilities
    VerifiedPrograms = @("Nippers", "Patrols", "Courses and training", "Youth members", "Active award members")
    BestFor = @("Goolwa and Fleurieu families", "Members seeking a clear fee schedule", "People interested in patrol and junior pathways")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Ask club"
    MulticulturalProgram = "Ask club"
    GymFacilities = "Ask club"
    FamilyFriendly = "Yes"
    BadgeLabel = "Clear fee info"
    BadgeType = "blue"
    Overview = "Goolwa SLSC publishes membership information and fees for families, active/award members and youth members. It is a strong option for families on the Fleurieu Peninsula who want a structured surf lifesaving club pathway."
    Offerings = @(
      "Nippers and family membership pathways.",
      "Active and award member pathways for patrolling members.",
      "Courses and training information.",
      "Regional coastal community participation."
    )
    Training = @(
      "Club website includes courses and training information.",
      "Nipper and family participation requires parent membership with a child in the Nipper program.",
      "Current training timetable should be confirmed each season."
    )
    Fees = @(
      "Family one-parent examples publicly listed: 1 adult and 1 child $180; 1 adult and 2 children $260; 1 adult and 3 children $340; 1 adult and 4+ children $400.",
      "Family two-parent examples publicly listed: 2 adults and 2 children $350; 2 adults with 3+ children $400.",
      "Active/Award member publicly listed as $150.",
      "Youth member publicly listed as $80."
    )
    Culture = @(
      "Family-oriented coastal club.",
      "Good fit for members who want clear joining categories and a regional beach community.",
      "Likely to suit both junior families and adult patrolling members."
    )
    DecisionNotes = @(
      "Choose Goolwa if you are in the Goolwa/Fleurieu area and want a clear family joining pathway.",
      "Good candidate for families comparing costs across clubs.",
      "Confirm current season rates and Sports Voucher treatment before joining."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://goolwaslsc.com.au/",
      "Join us: https://goolwaslsc.com.au/join-us/",
      "Courses and training: https://goolwaslsc.com.au/courses-training/",
      "Nippers: https://goolwaslsc.com.au/nippers/"
    )
  },
  @{
    FileName = "grange-surf-life-saving-club.md"
    Title = "Grange Surf Life Saving Club"
    Slug = "grange-surf-life-saving-club"
    Summary = "A western metropolitan club patrolling a long stretch of Adelaide coastline, with Nippers, surf sports, training and strong family participation."
    ImageFile = "grange-surf-life-saving-club.jpg"
    Suburb = "Grange"
    Region = "Adelaide Metro"
    Address = "497 Esplanade, Grange SA 5022"
    Website = "https://www.grangeslsc.asn.au/"
    Latitude = "-34.9028"
    Longitude = "138.4894"
    MemberSize = "Large metro club"
    MembershipFeeNote = "Club directs members to the membership page and supports Sports Vouchers. Specific current prices were not captured in this pass."
    MembershipFeeSource = "https://www.grangeslsc.asn.au/membership"
    AgeGroups = $commonSurfAges
    Interests = $commonSurfInterests
    Facilities = $commonSurfFacilities
    VerifiedPrograms = @("Tiny Tots", "Nippers", "Youth", "Training", "Surf sports", "Come and Try Nippers")
    BestFor = @("Western suburbs families", "Children starting Nippers", "Members interested in surf sports", "People wanting a large beach club")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Ask club"
    MulticulturalProgram = "Ask club"
    GymFacilities = "Ask club"
    FamilyFriendly = "Yes"
    BadgeLabel = "Western beaches"
    BadgeType = "blue"
    Overview = "Grange SLSC publicly describes providing voluntary service along 6 km of one of Adelaide’s busiest stretches of beach. Its public pages include Nippers, training, surf sports, Come and Try information and membership renewal information."
    Offerings = @(
      "Tiny Tots for 5 years to under 7.",
      "Nippers for under 8 to under 13.",
      "Youth and adult training pathways.",
      "Junior and senior surf sports.",
      "Come and Try Nippers sessions."
    )
    Training = @(
      "Training page describes programs for Tiny Tots, Nippers and Youth.",
      "Surf sports communications include training times and locations via Facebook closed group and Team App.",
      "Come and Try Nippers offers two free sessions during the season."
    )
    Fees = @(
      "Membership page references Sports Vouchers and membership payment process.",
      "Specific current rates were not captured from public snippets in this pass.",
      "Confirm current fee schedule with Grange SLSC before publishing."
    )
    Culture = @(
      "Large western-suburbs club with Nippers, youth and surf sports pathways.",
      "Strong family participation around junior programs.",
      "Good fit for members wanting a busy metro beach club with structured training."
    )
    DecisionNotes = @(
      "Choose Grange if you are in the western suburbs and want a club with strong junior and surf sports pathways.",
      "Good option for families who want Come and Try before committing.",
      "Confirm fees and current training channels with the club."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://www.grangeslsc.asn.au/",
      "Membership: https://www.grangeslsc.asn.au/membership",
      "Training: https://www.grangeslsc.asn.au/training",
      "About Nippers: https://www.grangeslsc.asn.au/about-nippers",
      "Come and Try: https://www.grangeslsc.asn.au/come-and-try",
      "Surf sports: https://www.grangeslsc.asn.au/surf-sports"
    )
  },
  @{
    FileName = "henley-surf-life-saving-club.md"
    Title = "Henley Surf Life Saving Club"
    Slug = "henley-surf-life-saving-club"
    Summary = "South Australia’s oldest surf life saving club, with Nippers, lifesaving, surf sports, training and publicly listed 2025/26 fees."
    ImageFile = "henley-surf-life-saving-club.jpg"
    Suburb = "Henley Beach"
    Region = "Adelaide Metro"
    Address = "246 The Esplanade, Henley Beach SA 5022"
    Website = "https://www.henleyslsc.com.au/"
    Latitude = "-34.9207"
    Longitude = "138.4945"
    MemberSize = "Large metro club"
    MembershipFeeNote = "Public 2025/26 pricing listed on club membership page."
    MembershipFeeSource = "https://www.henleyslsc.com.au/membership"
    AgeGroups = $commonSurfAges
    Interests = $commonSurfInterests
    Facilities = $commonSurfFacilities + @("hospitality")
    VerifiedPrograms = @("Nippers", "Lifesaving", "Surf sports", "Training", "Bronze/SRC pathways")
    BestFor = @("Families near Henley Beach", "Members wanting a historic club", "Athletes interested in structured surf sports", "People seeking lifesaving training")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Ask club"
    MulticulturalProgram = "Ask club"
    GymFacilities = "Ask club"
    FamilyFriendly = "Yes"
    BadgeLabel = "Historic club"
    BadgeType = "yellow"
    Overview = "Henley SLSC describes itself as South Australia’s oldest surf lifesaving organisation and highlights lifesaving, community and sport. The club publishes clear 2025/26 membership pricing and information for Nippers, lifesaving and surf sports."
    Offerings = @(
      "Nippers for children aged 5 to 13.",
      "Lifesaving training including patrol and emergency care pathways.",
      "Surf sports programs and athlete development.",
      "Supporter membership option."
    )
    Training = @(
      "Lifesaving page describes training across first aid, advanced resuscitation, search and rescue and patrol captain pathways.",
      "Surf sports page describes structured coaching support and team culture.",
      "Current training times should be confirmed with the club."
    )
    Fees = @(
      "Bronze 18+ active: $220, or $270 for new members training.",
      "Bronze 15-18: $200.",
      "Youth 13-15: $200.",
      "Junior U8-13: $200.",
      "Tots U6-7: $150.",
      "Supporter member: $50."
    )
    Culture = @(
      "Historic club with strong lifesaving tradition.",
      "Public material emphasises community safety, member development and sport excellence.",
      "Good fit for families and members looking for a well-established metro club."
    )
    DecisionNotes = @(
      "Choose Henley if you value a long-established club with clear fee information.",
      "Strong candidate for surf sports and lifesaving training pathways.",
      "Good option for western-suburbs families."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://www.henleyslsc.com.au/",
      "Membership: https://www.henleyslsc.com.au/membership",
      "Nippers: https://www.henleyslsc.com.au/nippers",
      "Lifesaving: https://www.henleyslsc.com.au/lifesaving",
      "Surf sports: https://www.henleyslsc.com.au/surf-sports",
      "About: https://www.henleyslsc.com.au/about"
    )
  },
  @{
    FileName = "moana-surf-life-saving-club.md"
    Title = "Moana Surf Life Saving Club"
    Slug = "moana-surf-life-saving-club"
    Summary = "A southern coastal club with Nippers, Surf Babies, member education, training, patrols, junior activities and function facilities."
    ImageFile = "moana-surf-life-saving-club.jpg"
    Suburb = "Moana"
    Region = "South Metro"
    Address = "The Esplanade, Moana SA 5169"
    Website = "https://moanaslsc.com.au/"
    Latitude = "-35.1977"
    Longitude = "138.4690"
    MemberSize = "Medium coastal club"
    MembershipFeeNote = "Public membership page includes junior membership $160 and family/Nipper parent membership information. Confirm current full fee schedule with club."
    MembershipFeeSource = "https://moanaslsc.com.au/membership-information/"
    AgeGroups = $commonSurfAges
    Interests = $commonSurfInterests + @("surf-babies")
    Facilities = $commonSurfFacilities + @("hospitality")
    VerifiedPrograms = @("Nippers", "Surf Babies", "Training services", "SRC/Bronze/Drone/IRB training references", "Function venue")
    BestFor = @("Southern suburbs families", "Children aged 5-13", "Families interested in Surf Babies or Nippers", "Members wanting broad training options")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Ask club"
    MulticulturalProgram = "Ask club"
    GymFacilities = "Use of club facilities excluding gym noted for some membership options"
    FamilyFriendly = "Yes"
    BadgeLabel = "Southern beaches"
    BadgeType = "blue"
    Overview = "Moana SLSC publishes membership information, junior information and training services. Public material describes Nippers for children aged 5-13, Saturday afternoon sessions and member education as a core club function."
    Offerings = @(
      "Nippers for children from 5 to 13.",
      "Surf Babies pathway referenced on club site.",
      "Training services and member education.",
      "Variety of training referenced, including SRC, Bronze, Drone and IRB.",
      "Function and club venue facilities."
    )
    Training = @(
      "Nippers publicly listed as Saturday afternoon from 1:30pm to 4:00pm.",
      "Junior members gain skills through weekly junior nipper training during the surf lifesaving season.",
      "Club website advises contacting Pete for training times and attendance registration."
    )
    Fees = @(
      "Junior membership publicly listed as $160.",
      "Nipper parent/guardian and family membership options are published on the club site.",
      "Full current fee schedule should be confirmed with the club before publishing."
    )
    Culture = @(
      "Family-focused southern beach club.",
      "Public material emphasises community, junior development and training.",
      "Good fit for families wanting a southern metro club with Nippers and broad training options."
    )
    DecisionNotes = @(
      "Choose Moana if you are in the southern suburbs and want Nippers on Saturday afternoons.",
      "Good candidate for families interested in Surf Babies, Nippers and lifesaving training.",
      "Confirm membership category and any gym/facility inclusions before joining."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://moanaslsc.com.au/",
      "Membership information: https://moanaslsc.com.au/membership-information/",
      "Nippers: https://moanaslsc.com.au/nippers/",
      "Training services: https://moanaslsc.com.au/training-services/",
      "Contact: https://moanaslsc.com.au/contact/"
    )
  },
  @{
    FileName = "murray-bridge-life-saving-club.md"
    Title = "Murray Bridge Life Saving Club"
    Slug = "murray-bridge-life-saving-club"
    Summary = "A regional inland life saving club supporting water safety, lifesaving training and community participation in the Murraylands."
    ImageFile = "murray-bridge-life-saving-club.jpg"
    Suburb = "Murray Bridge"
    Region = "Murraylands"
    Address = "Murray Bridge SA 5253"
    Website = "https://www.mblsc.com.au/"
    Latitude = "-35.1199"
    Longitude = "139.2738"
    MemberSize = "Regional life saving club"
    MembershipFeeNote = "Current public fees not verified in this pass. Confirm with club."
    MembershipFeeSource = ""
    AgeGroups = @("youth", "adults", "families")
    Interests = @("training", "volunteering", "community", "water-safety")
    Facilities = @("clubrooms", "family-friendly", "training")
    VerifiedPrograms = @("Inland water safety", "Lifesaving training", "Regional community volunteering")
    BestFor = @("Murraylands families", "People interested in inland water safety", "Regional volunteers")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Ask club"
    MulticulturalProgram = "Ask club"
    GymFacilities = "Ask club"
    FamilyFriendly = "Yes"
    BadgeLabel = "Inland lifesaving"
    BadgeType = "community"
    Overview = "Murray Bridge LSC is listed by SLSSA as part of the South Australian lifesaving club network. It is important to include because it supports the organisation’s inland and regional water-safety footprint."
    Offerings = @(
      "Regional lifesaving and water safety participation.",
      "Community volunteering and training pathways.",
      "Inland waterway context rather than surf beach environment."
    )
    Training = @(
      "Training days and program details should be confirmed with the club.",
      "Use the club website or SLSSA directory listing for current contact information."
    )
    Fees = @(
      "Current public fee schedule was not verified in this pass.",
      "Confirm directly with Murray Bridge Life Saving Club."
    )
    Culture = @(
      "Regional and inland lifesaving focus.",
      "Good fit for members who do not live near the surf coast but want to participate in lifesaving."
    )
    DecisionNotes = @(
      "Choose Murray Bridge LSC if you are in the Murraylands or want an inland lifesaving pathway.",
      "Confirm program age groups, training days and fees directly with the club."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://www.mblsc.com.au/"
    )
  },
  @{
    FileName = "normanville-surf-life-saving-club.md"
    Title = "Normanville Surf Life Saving Club"
    Slug = "normanville-surf-life-saving-club"
    Summary = "A Fleurieu Peninsula club with publicly listed membership categories, Nippers, patrol and community participation."
    ImageFile = "normanville-surf-life-saving-club.jpg"
    Suburb = "Normanville"
    Region = "Fleurieu Peninsula"
    Address = "Beachfront, Jetty Road, Normanville SA 5204"
    Website = "https://normanvilleslsc.org.au/"
    Latitude = "-35.4473"
    Longitude = "138.3150"
    MemberSize = "Regional coastal club"
    MembershipFeeNote = "Public 2025 membership page lists senior, family and youth membership examples. Confirm current details before publishing."
    MembershipFeeSource = "https://normanvilleslsc.org.au/membership/"
    AgeGroups = $commonSurfAges
    Interests = @("lifesaving-patrols", "nippers", "training", "volunteering", "community")
    Facilities = $commonSurfFacilities + @("hospitality")
    VerifiedPrograms = @("Nippers", "Senior membership", "Family membership", "Training access", "Patrol uniform for senior Bronze holders")
    BestFor = @("Normanville and Yankalilla families", "Members seeking a smaller Fleurieu club", "Families comparing fee levels")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Ask club"
    MulticulturalProgram = "Ask club"
    GymFacilities = "Ask club"
    FamilyFriendly = "Yes"
    BadgeLabel = "Fleurieu club"
    BadgeType = "community"
    Overview = "Normanville SLSC publicly lists membership categories and benefits, including senior, youth and family membership. It is a strong option for families and volunteers around Normanville and the western Fleurieu."
    Offerings = @(
      "Nippers and family membership pathway.",
      "Senior patrolling member pathway for Bronze Medallion holders.",
      "Training access and club facilities.",
      "Member prices at the club bar for eligible adults."
    )
    Training = @(
      "Membership page references access to training.",
      "Nippers included within family membership benefits.",
      "Current training days should be confirmed directly with the club."
    )
    Fees = @(
      "Senior membership publicly listed as $120.",
      "Family membership publicly listed as $200 for either 2 adults and 2 children or 1 adult and 3 children.",
      "Additional children can be added to Family Membership for an additional $25 per child.",
      "Youth membership publicly listed as $65."
    )
    Culture = @(
      "Smaller regional coastal club on the Fleurieu Peninsula.",
      "Likely to suit local families and members who want a community beach club.",
      "Clear public fee information helps families compare joining cost."
    )
    DecisionNotes = @(
      "Choose Normanville if you are near Normanville, Yankalilla or the western Fleurieu.",
      "Good fit for families wanting a lower-cost regional family membership.",
      "Confirm current season dates, Nippers times and eligibility with the club."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://normanvilleslsc.org.au/",
      "Membership: https://normanvilleslsc.org.au/membership/"
    )
  },
  @{
    FileName = "north-haven-surf-life-saving-club.md"
    Title = "North Haven Surf Life Saving Club"
    Slug = "north-haven-surf-life-saving-club"
    Summary = "A north-western metropolitan club with a relaxed community setting, Nippers, lifesaving training, patrols, gym access and hospitality."
    ImageFile = "north-haven-surf-life-saving-club.jpg"
    Suburb = "North Haven"
    Region = "Adelaide Metro"
    Address = "44 Australia II Drive, North Haven SA 5018"
    Website = "https://www.northhavenslsc.com.au/"
    Latitude = "-34.7879"
    Longitude = "138.4897"
    MemberSize = "Medium metro club"
    MembershipFeeNote = "General membership fees not captured in this pass. Gym membership publicly listed as $150 per year plus $25 fob access."
    MembershipFeeSource = "https://www.northhavenslsc.com.au/gym"
    AgeGroups = $commonSurfAges
    Interests = $commonSurfInterests
    Facilities = $commonSurfFacilities + @("hospitality", "gym")
    VerifiedPrograms = @("Nippers", "Seniors", "Lifesaving training", "Gym", "Hospitality", "Sports Vouchers")
    BestFor = @("North-western suburbs families", "Members wanting a relaxed community club", "People interested in lifesaving training", "Members wanting gym access")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Ask club"
    MulticulturalProgram = "Ask club"
    GymFacilities = "24/7 gym listed"
    FamilyFriendly = "Yes"
    BadgeLabel = "Gym available"
    BadgeType = "blue"
    Overview = "North Haven SLSC describes itself as a community-driven organisation with a relaxed, rural community atmosphere near the dunes of North Haven Beach. The club highlights patrols, inclusive training, Nippers, seniors and families, and was promoted on its website as a recent Club of the Year."
    Offerings = @(
      "Nippers, seniors and family participation.",
      "Beach safety patrols and lifesaving training.",
      "Working With Children Check process for volunteers aged 14 and over.",
      "Sports Vouchers participation.",
      "24/7 gym access with induction and fob requirements.",
      "Breakwater Cafe and Bar member benefits."
    )
    Training = @(
      "Become a Lifesaver page says the club, in partnership with SLSSA, provides free nationally recognised training to help members become patrolling members.",
      "First aid and resuscitation are highlighted as useful skills.",
      "Current Nipper and training times should be confirmed with the club."
    )
    Fees = @(
      "Gym membership publicly listed as $150 per year plus $25 fob access.",
      "General membership fees were not captured in public snippets during this pass.",
      "Working With Children Check requirements apply to volunteers aged 14 years and over."
    )
    Culture = @(
      "Warm, welcoming, relaxed north-western metro community club.",
      "Good fit for families and members who value a beach community with social facilities.",
      "Strong emphasis on teamwork, volunteer spirit and local beach safety."
    )
    DecisionNotes = @(
      "Choose North Haven if you are around the Lefevre Peninsula or northern-western beaches.",
      "Good option if gym access and a relaxed community culture matter.",
      "Confirm membership fees, Nippers times and WWCC process before joining."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://www.northhavenslsc.com.au/",
      "Join or renew: https://www.northhavenslsc.com.au/join-or-renew",
      "Become a lifesaver: https://www.northhavenslsc.com.au/becomealifesaver",
      "Gym: https://www.northhavenslsc.com.au/gym"
    )
  },
  @{
    FileName = "port-elliot-surf-life-saving-club.md"
    Title = "Port Elliot Surf Life Saving Club"
    Slug = "port-elliot-surf-life-saving-club"
    Summary = "A Fleurieu Peninsula club at Horseshoe Bay with Nippers, Flying Fishes, Same Wave, lifesaving, surf sports and publicly listed membership categories."
    ImageFile = "port-elliot-surf-life-saving-club.jpg"
    Suburb = "Port Elliot"
    Region = "Fleurieu Peninsula"
    Address = "Horseshoe Bay, Port Elliot SA 5212"
    Website = "https://portelliotslsc.com.au/"
    Latitude = "-35.5324"
    Longitude = "138.6842"
    MemberSize = "Medium coastal club"
    MembershipFeeNote = "Public Nipper registration page lists junior, full adult, Nipper associate and community membership fees. Confirm current season before publishing."
    MembershipFeeSource = "https://portelliotslsc.com.au/register-your-nippers"
    AgeGroups = $commonSurfAges
    Interests = $commonSurfInterests + @("inclusive-programs")
    Facilities = $commonSurfFacilities + @("hospitality")
    VerifiedPrograms = @("Nippers", "Flying Fishes", "Same Wave", "Surf sports", "Lifesaving", "Membership categories")
    BestFor = @("Fleurieu families", "Children aged 9-13 focused on Nippers", "Members interested in inclusive programs", "People near Port Elliot and Victor Harbor")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Same Wave listed"
    MulticulturalProgram = "Ask club"
    GymFacilities = "Ask club"
    FamilyFriendly = "Yes"
    BadgeLabel = "Horseshoe Bay"
    BadgeType = "blue"
    Overview = "Port Elliot SLSC is based at Horseshoe Bay and publicly lists Nippers, Flying Fishes, Same Wave and membership information. It is a strong Fleurieu Peninsula option for families and lifesaving volunteers."
    Offerings = @(
      "Nippers program for 9-13 year olds and under 8/9s wanting to compete in carnivals.",
      "Flying Fishes junior pathway.",
      "Same Wave inclusive program referenced in club access policy.",
      "Lifesaving, membership, surf sports and training enquiries through club contact channels."
    )
    Training = @(
      "Nippers page states the program runs on Saturdays between 1:00pm and 3:00pm.",
      "Access policy references patrols, Nippers, training and Same Wave as operating contexts.",
      "Current program dates should be confirmed each season."
    )
    Fees = @(
      "Junior membership including Nippers under 18 on 1 October: $100.",
      "Full adult membership over 18: $180.",
      "Nipper associate: $30.",
      "Community membership listed publicly on the registration page.",
      "One-off SLSSA training fee of $55 is referenced on the membership page for first adult training."
    )
    Culture = @(
      "Fleurieu club with a strong bay-based identity.",
      "Good fit for families around Port Elliot, Victor Harbor and nearby towns.",
      "Inclusive programming references make it worth confirming options for members needing adapted participation."
    )
    DecisionNotes = @(
      "Choose Port Elliot if Horseshoe Bay is your local or preferred beach.",
      "Good candidate for families looking for clear junior membership pricing.",
      "Confirm eligibility, current Nipper age bands and Same Wave details with the club."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://portelliotslsc.com.au/",
      "Membership: https://portelliotslsc.com.au/membership",
      "Register Nippers: https://portelliotslsc.com.au/register-your-nippers",
      "Nippers: https://portelliotslsc.com.au/nippers",
      "Club: https://portelliotslsc.com.au/club"
    )
  },
  @{
    FileName = "port-noarlunga-surf-life-saving-club.md"
    Title = "Port Noarlunga Surf Life Saving Club"
    Slug = "port-noarlunga-surf-life-saving-club"
    Summary = "A southern metropolitan club at Port Noarlunga, close to the reef and jetty, with patrols, Nippers, training, surf sports and volunteering."
    ImageFile = "port-noarlunga-surf-life-saving-club.jpg"
    Suburb = "Port Noarlunga"
    Region = "South Metro"
    Address = "Corner Saltfleet Street and Esplanade, Port Noarlunga SA 5167"
    Website = "https://pnslsc.com.au/"
    Latitude = "-35.1496"
    Longitude = "138.4672"
    MemberSize = "Medium metro club"
    MembershipFeeNote = "Current public membership fees not verified in this pass. Confirm with club."
    MembershipFeeSource = ""
    AgeGroups = $commonSurfAges
    Interests = $commonSurfInterests
    Facilities = $commonSurfFacilities
    VerifiedPrograms = @("Nippers", "Lifesaving patrols", "Training", "Surf sports", "Community volunteering")
    BestFor = @("Families around Port Noarlunga", "People near the reef and southern metro beaches", "Members wanting a local surf club")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Ask club"
    MulticulturalProgram = "Ask club"
    GymFacilities = "Ask club"
    FamilyFriendly = "Yes"
    BadgeLabel = "Reef beach"
    BadgeType = "blue"
    Overview = "Port Noarlunga SLSC is listed by SLSSA at the corner of Saltfleet Street and Esplanade, placing it close to one of Adelaide’s most distinctive reef and jetty beach environments."
    Offerings = @(
      "Lifesaving patrols and beach safety participation.",
      "Nippers, training, surf sports and club volunteering pathways should be confirmed with the club.",
      "Southern metropolitan beach community."
    )
    Training = @(
      "Current training days and Nipper details were not verified in this pass.",
      "Use the club website or SLSSA directory details to confirm current season information."
    )
    Fees = @(
      "Current public fee schedule was not verified in this pass.",
      "Confirm fees and categories directly with the club."
    )
    Culture = @(
      "Local southern metropolitan club with a strong beach identity.",
      "Likely to suit families and volunteers around Port Noarlunga, Noarlunga and nearby suburbs."
    )
    DecisionNotes = @(
      "Choose Port Noarlunga if it is your local beach or you want the reef/jetty environment.",
      "Confirm Nippers, patrol expectations, training days and fees before joining."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://pnslsc.com.au/"
    )
  },
  @{
    FileName = "robe-surf-life-saving-club.md"
    Title = "Robe Surf Life Saving Club"
    Slug = "robe-surf-life-saving-club"
    Summary = "A growing Limestone Coast club with a January Nippers program, summer patrols and a regional community lifesaving focus."
    ImageFile = "robe-surf-life-saving-club.jpg"
    Suburb = "Robe"
    Region = "Limestone Coast"
    Address = "Robe SA 5276"
    Website = "https://www.robesls.club/"
    Latitude = "-37.1646"
    Longitude = "139.7606"
    MemberSize = "Regional club"
    MembershipFeeNote = "Public 2023/24 fee examples listed. Confirm current season fees before publishing."
    MembershipFeeSource = "https://www.robesls.club/nippers-1"
    AgeGroups = @("nippers", "youth", "adults", "families")
    Interests = @("lifesaving-patrols", "nippers", "training", "volunteering", "community")
    Facilities = @("beach-access", "clubrooms", "family-friendly", "training")
    VerifiedPrograms = @("January Nippers", "Growing patrol service", "Training courses", "Starfish referenced with Nippers")
    BestFor = @("Limestone Coast families", "January holiday participation", "Regional volunteers", "Families wanting a short seasonal Nippers program")
    CommitmentId = "seasonal"
    CommitmentLabel = "Seasonal"
    AdaptiveProgram = "Starfish referenced; confirm with club"
    MulticulturalProgram = "Ask club"
    GymFacilities = "Ask club"
    FamilyFriendly = "Yes"
    BadgeLabel = "Regional January Nippers"
    BadgeType = "community"
    Overview = "Robe SLSC says it was established in 2011 and affiliated in 2022. Its public material highlights a successful Nippers program running in January each year and a growing summer patrol service around Robe."
    Offerings = @(
      "January Nippers program.",
      "Growing summer patrol service around Robe.",
      "Training courses and volunteer lifesaving roles.",
      "Regional community water safety and club development."
    )
    Training = @(
      "Nippers development program is designed for children aged 5-13.",
      "Activities include beach sprints, flags, boards, wading, body surfing, relays, swimming and water safety.",
      "Training courses page promotes skills, accreditation and volunteer opportunities."
    )
    Fees = @(
      "2023/24 Junior Activity Member 5-13 years: $50.",
      "2023/24 Cadet Member 13-15 years: $50.",
      "2023/24 first parent of Junior or Cadet Member: $10.",
      "Confirm current season rates before publishing."
    )
    Culture = @(
      "Small but growing regional club.",
      "Good fit for families in Robe or seasonal visitors who can commit during January.",
      "Public materials emphasise safe, welcoming participation and confidence building."
    )
    DecisionNotes = @(
      "Choose Robe if you are in the Limestone Coast or regularly spend January at Robe.",
      "Good fit for children wanting an intensive summer holiday Nippers program.",
      "Confirm current dates and fees because the club has a seasonal pattern."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://www.robesls.club/",
      "Nippers: https://www.robesls.club/nippers",
      "Nippers fees page: https://www.robesls.club/nippers-1",
      "Training courses: https://www.robesls.club/training-courses",
      "What's on: https://www.robesls.club/whats-on-1"
    )
  },
  @{
    FileName = "seacliff-surf-life-saving-club.md"
    Title = "Seacliff Surf Life Saving Club"
    Slug = "seacliff-surf-life-saving-club"
    Summary = "A large metropolitan club with Nippers, surf sports, lifesaving training, hospitality and publicly listed 2025/26 membership fees."
    ImageFile = "seacliff-surf-life-saving-club.jpg"
    Suburb = "Seacliff"
    Region = "Adelaide Metro"
    Address = "248 Esplanade, Seacliff SA 5049"
    Website = "https://www.seacliffslsc.com.au/"
    Latitude = "-35.0342"
    Longitude = "138.5133"
    MemberSize = "Large metro club"
    MembershipFeeNote = "Public 2025/26 fees listed on membership and Nipper registration pages."
    MembershipFeeSource = "https://www.seacliffslsc.com.au/membership/"
    AgeGroups = $commonSurfAges
    Interests = $commonSurfInterests
    Facilities = $commonSurfFacilities + @("hospitality")
    VerifiedPrograms = @("Nippers", "Surf sports academy", "IRB training", "Swimming training", "Hospitality", "Membership fees")
    BestFor = @("Families near Seacliff", "Members comparing fees", "Athletes interested in surf sports", "People wanting bar/bistro facilities")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Ask club"
    MulticulturalProgram = "Ask club"
    GymFacilities = "Ask club"
    FamilyFriendly = "Yes"
    BadgeLabel = "Clear 2025/26 fees"
    BadgeType = "yellow"
    Overview = "Seacliff SLSC publishes detailed 2025/26 membership fees, Nipper registration information, training information, surf sports academy information and hospitality details through the Seacliff Surfy."
    Offerings = @(
      "Nippers with Saturday sessions and optional additional weekly training.",
      "Surf sports academy and athlete support.",
      "IRB and lifesaving training opportunities.",
      "Swimming training sessions at State Swim referenced.",
      "Bar and bistro facilities."
    )
    Training = @(
      "Nippers information says family membership includes approximately 16 Saturday Nipper sessions.",
      "Optional additional training sessions are referenced, including run and board training.",
      "Subsidised swim squad sessions are referenced.",
      "Swimming training details for 2025 were to be confirmed."
    )
    Fees = @(
      "Junior U6 and U7: $150.",
      "Junior U8 to U13: $220.",
      "Youth 14-18: $180.",
      "Active Member 19 and above: $200.",
      "Family Membership: $580.",
      "Second parent to a fully paid Nipper: $60.",
      "Associate Member: $60."
    )
    Culture = @(
      "Large, established metro club with a strong junior, training and surf sports footprint.",
      "Good fit for families who want structured Nippers and optional training extras.",
      "Hospitality facilities may appeal to families wanting a social club setting."
    )
    DecisionNotes = @(
      "Choose Seacliff if you want a large metro club with clear fees and strong junior/sport pathways.",
      "Good candidate for families comparing Nipper cost and inclusions.",
      "Confirm current swim/training arrangements before joining."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://www.seacliffslsc.com.au/",
      "Membership: https://www.seacliffslsc.com.au/membership/",
      "Nipper registration: https://www.seacliffslsc.com.au/nipper-registration/",
      "Nippers: https://www.seacliffslsc.com.au/home/about-nippers/",
      "Training: https://www.seacliffslsc.com.au/training/",
      "Surf sports academy: https://www.seacliffslsc.com.au/surf-sports-academy/",
      "Contact: https://www.seacliffslsc.com.au/home/contact-us/"
    )
  },
  @{
    FileName = "semaphore-surf-life-saving-club.md"
    Title = "Semaphore Surf Life Saving Club"
    Slug = "semaphore-surf-life-saving-club"
    Summary = "A north-western metropolitan club at Semaphore Park with Nippers, patrols, training, inclusive Seabirds information and community volunteering."
    ImageFile = "semaphore-surf-life-saving-club.jpg"
    Suburb = "Semaphore Park"
    Region = "Adelaide Metro"
    Address = "Point Malcolm Reserve, Military Road, Semaphore Park SA 5019"
    Website = "https://semaphoreslsc.com.au/"
    Latitude = "-34.8515"
    Longitude = "138.4775"
    MemberSize = "Medium metro club"
    MembershipFeeNote = "Come and Try Nippers publicly listed as $25 for three attendances. Full current fees not verified in this pass."
    MembershipFeeSource = "https://semaphoreslsc.com.au/nippers-come-and-try-2/"
    AgeGroups = $commonSurfAges
    Interests = $commonSurfInterests + @("inclusive-programs")
    Facilities = $commonSurfFacilities
    VerifiedPrograms = @("Nippers", "Come and Try Nippers", "Seabirds inclusive Nipper Program", "Sports Vouchers", "Training pack references")
    BestFor = @("Families in Semaphore and north-western Adelaide", "Children trying Nippers before joining", "Members interested in inclusive junior participation")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Seabirds inclusive Nipper Program"
    MulticulturalProgram = "Ask club"
    GymFacilities = "Ask club"
    FamilyFriendly = "Yes"
    BadgeLabel = "Inclusive Nippers"
    BadgeType = "community"
    Overview = "Semaphore SLSC public information includes Come and Try Nippers, Nipper handbook material and a Seabirds inclusive Nipper Program. The club is a key north-western metro option around Semaphore Park."
    Offerings = @(
      "Nippers across Under 6 to Under 13 age groups.",
      "Come and Try Nippers.",
      "Seabirds inclusive Nipper Program.",
      "Sports Voucher information.",
      "Training pack and uniform shop references."
    )
    Training = @(
      "Come and Try program runs from season start to the second-to-last Saturday in November.",
      "Nipper handbook covers the 2025/26 season.",
      "Current full training timetable should be confirmed with the club."
    )
    Fees = @(
      "Come and Try Nippers publicly listed as $25 for three attendances, deducted from membership fee if the child signs up.",
      "Sports Voucher information is referenced.",
      "Full current membership fees were not captured in this pass."
    )
    Culture = @(
      "Family-oriented north-western metro club.",
      "Inclusive junior participation is a differentiator through Seabirds.",
      "Good fit for families wanting a trial before committing."
    )
    DecisionNotes = @(
      "Choose Semaphore if you are near Semaphore Park and want Nippers or inclusive junior participation.",
      "Good option if you want to try Nippers before committing.",
      "Confirm full membership categories and costs with the club."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://semaphoreslsc.com.au/",
      "Come and Try Nippers: https://semaphoreslsc.com.au/nippers-come-and-try-2/",
      "Seabirds inclusive program: https://semaphoreslsc.com.au/seabirds-inclusive-nipper-program/",
      "Nipper handbook: https://semaphoreslsc.com.au/wp-content/uploads/2025/10/Nippers-handbook-25-26-cpmress.pdf"
    )
  },
  @{
    FileName = "somerton-surf-life-saving-club.md"
    Title = "Somerton Surf Life Saving Club"
    Slug = "somerton-surf-life-saving-club"
    Summary = "A metropolitan club at Somerton Park with Nippers, patrols, surf sports, training timetable information, SomerSquad and bar/bistro facilities."
    ImageFile = "somerton-surf-life-saving-club.jpg"
    Suburb = "Somerton Park"
    Region = "Adelaide Metro"
    Address = "Corner Repton Road and Esplanade, Somerton Park SA 5044"
    Website = "https://somertonsurfclub.com.au/wp/"
    Latitude = "-34.9980"
    Longitude = "138.5143"
    MemberSize = "Medium metro club"
    MembershipFeeNote = "Membership categories and fees page exists, but exact public fee values were not captured in this pass. Confirm with club."
    MembershipFeeSource = "https://somertonsurfclub.com.au/wp/membership-categories/"
    AgeGroups = $commonSurfAges
    Interests = $commonSurfInterests
    Facilities = $commonSurfFacilities + @("hospitality")
    VerifiedPrograms = @("Nippers", "SomerSquad", "Patrol roster", "Surf boats", "IRB racing", "Swimming", "Training timetable", "Bar and bistro")
    BestFor = @("Families near Somerton Park", "Members wanting a mid-sized metro club", "Surf sports participants", "People interested in patrol and training")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Ask club"
    MulticulturalProgram = "Ask club"
    GymFacilities = "Ask club"
    FamilyFriendly = "Yes"
    BadgeLabel = "Metro club"
    BadgeType = "blue"
    Overview = "Somerton Surf Club publishes membership category information, junior/Nipper information, patrol details, surf sports and a training timetable. The club also has bar and bistro facilities."
    Offerings = @(
      "Nippers for age 5 to under 13.",
      "SomerSquad referenced in club membership/navigation.",
      "Surf boats, IRB racing, swimming and training timetable information.",
      "Patrol roster and lifesaving information.",
      "Bar and bistro facilities."
    )
    Training = @(
      "Training timetable page includes club swim and ski training references.",
      "Nippers General Information states new members must register and pay before taking part.",
      "Current full training timetable should be checked on the club website."
    )
    Fees = @(
      "Membership categories and fees page exists.",
      "Exact current fee values were not captured from public snippets in this pass.",
      "Confirm current categories and costs with the club before publishing."
    )
    Culture = @(
      "Mid-sized metropolitan club with a broad spread of lifesaving, junior, sport and social facilities.",
      "Good fit for families around Somerton Park and Glenelg South.",
      "Useful option for members interested in surf sports disciplines."
    )
    DecisionNotes = @(
      "Choose Somerton if you want a metro club with Nippers, sport and hospitality facilities.",
      "Good option for families near Somerton Park, Glenelg South and Brighton.",
      "Confirm current fee table and training timetable before joining."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://somertonsurfclub.com.au/wp/",
      "Want to join: https://somertonsurfclub.com.au/wp/want-to-join/",
      "Membership categories: https://somertonsurfclub.com.au/wp/membership-categories/",
      "Nippers: https://somertonsurfclub.com.au/wp/nippers-general-information/",
      "Training timetable: https://somertonsurfclub.com.au/wp/training-timetable/"
    )
  },
  @{
    FileName = "south-port-surf-life-saving-club.md"
    Title = "South Port Surf Life Saving Club"
    Slug = "south-port-surf-life-saving-club"
    Summary = "A southern club at the mouth of the Onkaparinga River with Nippers, surf conditions, patrols, training and a relaxed beach environment."
    ImageFile = "south-port-surf-life-saving-club.jpg"
    Suburb = "Port Noarlunga South"
    Region = "South Metro"
    Address = "Weatherald Terrace, Port Noarlunga South SA 5167"
    Website = "https://www.southportslsc.org.au/"
    Latitude = "-35.1595"
    Longitude = "138.4669"
    MemberSize = "Medium coastal club"
    MembershipFeeNote = "Older annual report listed 2022/23 fees; current fees should be confirmed with club."
    MembershipFeeSource = "https://www.southportslsc.org.au/images/pdf/South_Port_Annual_Report_2021-22_LR.pdf"
    AgeGroups = $commonSurfAges
    Interests = $commonSurfInterests
    Facilities = $commonSurfFacilities
    VerifiedPrograms = @("Nippers", "Board training", "Beach training", "Pool training", "Patrol information", "Surf education")
    BestFor = @("Southern suburbs families", "People near Port Noarlunga South", "Members interested in surf conditions and board/body surfing", "Families wanting detailed junior training info")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Ask club"
    MulticulturalProgram = "Ask club"
    GymFacilities = "Older annual report references gym membership; confirm current"
    FamilyFriendly = "Yes"
    BadgeLabel = "Surf beach"
    BadgeType = "blue"
    Overview = "South Port SLSC is located in the sand dunes at the mouth of the Onkaparinga River Estuary. Its public website describes the beach as favourable for board riders and body surfers and says the club has saved over 500 lives."
    Offerings = @(
      "Nippers and junior training.",
      "Saturday Nipper training.",
      "Board training, beach training and pool training references.",
      "Patrol information and surf education.",
      "Relaxed beach environment."
    )
    Training = @(
      "Public junior information lists Saturday Nipper training from early October to mid-March.",
      "U6/7 sessions are listed as 2:00pm to 3:30pm.",
      "U8-13 sessions are listed as 2:00pm to 4:00pm.",
      "Board training Monday and Wednesday 5:00pm, beach training Wednesday 4:30pm, and pool training Tuesday 7:00pm to 8:00pm were referenced in published junior information.",
      "Parent/guardian must remain present during junior activities."
    )
    Fees = @(
      "Older 2022/23 annual report listed Community $60, Seniors $195, Family $310, Under 18s $120, Associate $120 and Gym $350.",
      "Treat these as historic only and confirm current season fees with the club."
    )
    Culture = @(
      "Relaxed southern beach club with a genuine surf environment.",
      "Likely to suit families and members who want strong junior training and surf skills.",
      "Good fit for people around Port Noarlunga South, Seaford and the Onkaparinga coast."
    )
    DecisionNotes = @(
      "Choose South Port if you want a southern club with surf conditions and detailed junior training structure.",
      "Good option for children who want board, beach and pool training.",
      "Confirm current fees, timetable and parent requirements before joining."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://www.southportslsc.org.au/",
      "Juniors information: https://www.southportslsc.org.au/juniors",
      "Junior training: https://www.southportslsc.org.au/juniors/item/117-junior-training-members-only",
      "Annual report with historic fees: https://www.southportslsc.org.au/images/pdf/South_Port_Annual_Report_2021-22_LR.pdf"
    )
  },
  @{
    FileName = "west-beach-surf-life-saving-club.md"
    Title = "West Beach Surf Life Saving Club"
    Slug = "west-beach-surf-life-saving-club"
    Summary = "A major Adelaide metropolitan club with patrols, volunteering, surf sports, social connection, venue facilities and a strong community spirit."
    ImageFile = "west-beach-surf-life-saving-club.jpg"
    Suburb = "West Beach"
    Region = "Adelaide Metro"
    Address = "Corner Seaview and West Beach Roads, West Beach SA 5024"
    Website = "https://www.westbeachslsc.com.au/"
    Latitude = "-34.9466"
    Longitude = "138.5025"
    MemberSize = "Large metro club"
    MembershipFeeNote = "Current public membership fees not verified in this pass. Confirm with club."
    MembershipFeeSource = ""
    AgeGroups = $commonSurfAges
    Interests = $commonSurfInterests
    Facilities = $commonSurfFacilities + @("hospitality")
    VerifiedPrograms = @("Compete", "Volunteer", "Food and beverage", "Member resources", "Community events")
    BestFor = @("Western metro families", "Members wanting a large club", "People interested in volunteering, sport or social connection", "People near West Beach and Henley South")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Ask club"
    MulticulturalProgram = "Ask club"
    GymFacilities = "Ask club"
    FamilyFriendly = "Yes"
    BadgeLabel = "Large metro club"
    BadgeType = "yellow"
    Overview = "West Beach SLSC publicly describes itself as a gathering place for ocean lovers, adventurers and community spirit since 1956. Its public site invites people to compete, volunteer, or enjoy food, drinks and views."
    Offerings = @(
      "Lifesaving and volunteering.",
      "Surf sports and competition participation.",
      "Member resources.",
      "Food and beverage / venue connection.",
      "Community and social participation."
    )
    Training = @(
      "Current training days were not captured from public snippets in this pass.",
      "Prospective members should confirm Nippers, training and patrol requirements with the club."
    )
    Fees = @(
      "Current public fee schedule was not verified in this pass.",
      "Confirm membership fees directly with West Beach SLSC."
    )
    Culture = @(
      "Large, social metropolitan club.",
      "Good fit for people who want volunteering, sport and community spirit.",
      "May suit families wanting a club with broader hospitality and social presence."
    )
    DecisionNotes = @(
      "Choose West Beach if you want a major metro club with strong community and social presence.",
      "Good option for people near West Beach, Henley South and Adelaide Airport.",
      "Confirm Nippers, training times and current fees before joining."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://www.westbeachslsc.com.au/"
    )
  },
  @{
    FileName = "whyalla-surf-life-saving-club.md"
    Title = "Whyalla Surf Life Saving Club"
    Slug = "whyalla-surf-life-saving-club"
    Summary = "A regional Upper Spencer Gulf club with lifesaving patrols, Nippers, training and community water safety."
    ImageFile = "whyalla-surf-life-saving-club.jpg"
    Suburb = "Whyalla"
    Region = "Upper Spencer Gulf"
    Address = "Whyalla Foreshore, Whyalla SA 5600"
    Website = "https://whyallaslsc.com.au/"
    Latitude = "-33.0338"
    Longitude = "137.5841"
    MemberSize = "Regional club"
    MembershipFeeNote = "Current public membership fees not verified in this pass. Confirm with club."
    MembershipFeeSource = ""
    AgeGroups = @("nippers", "youth", "adults", "families")
    Interests = @("lifesaving-patrols", "nippers", "training", "volunteering", "community")
    Facilities = @("beach-access", "clubrooms", "family-friendly", "training")
    VerifiedPrograms = @("Surf Rescue Certificate", "Bronze Medallion pathway", "Nippers water safety", "Beach patrols")
    BestFor = @("Whyalla families", "Upper Spencer Gulf volunteers", "People interested in regional beach safety", "Youth aged 13+ starting SRC")
    CommitmentId = "flexible"
    CommitmentLabel = "Flexible"
    AdaptiveProgram = "Ask club"
    MulticulturalProgram = "Ask club"
    GymFacilities = "Ask club"
    FamilyFriendly = "Yes"
    BadgeLabel = "Regional lifesaving"
    BadgeType = "community"
    Overview = "Whyalla SLSC is SLSSA’s Upper Spencer Gulf surf life saving club. Its public lifesaver page explains the Surf Rescue Certificate as a stepping stone to the Bronze Medallion and a minimum standard for water safety at Nippers and similar events."
    Offerings = @(
      "Surf lifesaving patrols.",
      "Surf Rescue Certificate and Bronze Medallion pathway.",
      "Water safety support for Nippers and similar events.",
      "Regional community volunteering."
    )
    Training = @(
      "Surf Rescue Certificate is described as originally intended for young people aged 13 to 15, but open to anyone over 13.",
      "Bronze Medallion is described as the minimum standard generally required for full patrolling duties.",
      "Current training dates and fees should be confirmed with the club."
    )
    Fees = @(
      "Current public fee schedule was not verified in this pass.",
      "Confirm fees directly with Whyalla SLSC."
    )
    Culture = @(
      "Regional club supporting the Whyalla foreshore and Upper Spencer Gulf.",
      "Good fit for families and volunteers who want regional community service.",
      "Practical pathway for youth and adults wanting lifesaving awards."
    )
    DecisionNotes = @(
      "Choose Whyalla if you are in the Upper Spencer Gulf and want a regional surf lifesaving pathway.",
      "Good option for youth aged 13+ interested in SRC and water safety.",
      "Confirm Nippers availability, training dates and fees with the club."
    )
    Sources = @(
      "SLSSA SA Clubs directory: https://www.surflifesavingsa.com.au/sa-clubs",
      "Club website: https://whyallaslsc.com.au/",
      "Become a life saver: https://whyallaslsc.com.au/become-a-life-saver/"
    )
  }
)

foreach ($club in $clubs) {
  Write-Host "Writing $($club.FileName)"
  Write-ClubFile -Club $club
}

Write-Host ""
Write-Host "Done. Wrote $($clubs.Count) club profiles to _clubs."
Write-Host "Run: bundle exec jekyll clean; bundle exec jekyll serve --livereload"