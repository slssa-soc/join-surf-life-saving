#!/usr/bin/env python3
"""
Update Jekyll club profile pages from the 2026/27 SLSSA club information return.

Run from the repository root (the folder containing _clubs/).

Dry run:
    py scripts/update_club_pages.py

Apply:
    py scripts/update_club_pages.py --apply

Requirements:
    py -m pip install pyyaml

What it does:
- finds each existing _clubs/*.md file by its front-matter title;
- preserves existing fields that are not being replaced (including image, suburb,
  region, latitude/longitude, commitment, badge configuration and any custom fields);
- changes page slug/permalink to the shorter -slsc / -lsc format;
- rewrites the profile body with the supplied 2026/27 information;
- adds structured contact/activity/membership data to front matter;
- creates a timestamped backup before writing;
- generates club-update-report.md listing source ambiguities and editorial/inferred changes;
- deliberately DOES NOT rename the physical Markdown files. Use the separate
  rename_club_files_to_slsc.py script after reviewing the update.
"""

from __future__ import annotations

import argparse
import copy
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

try:
    import yaml
except ImportError:
    raise SystemExit(
        "PyYAML is required.\n"
        "Install it with:\n"
        "  py -m pip install pyyaml"
    )

CLUBS = [{'title': 'Aldinga Bay Surf Life Saving Club',
  'slug': 'aldinga-bay-slsc',
  'source_document': 'Aldinga Club Information Page.docx',
  'address': 'Norman Rd, Aldinga Beach SA 5173',
  'website': 'https://aldingabaysurflifesavingclub.com/',
  'size': 'Medium',
  'contact_name': 'Tiffany Mayne',
  'contact_email': 'secretary@aldingabayslsc.onmicrosoft.com',
  'visit': 'During the patrol season, prospective members can visit on Saturdays or Sundays. Contact the club first to '
           'arrange a suitable time and someone can show you the facilities.',
  'nippers': 'Saturdays 1:30 pm–4:30 pm.',
  'youth': 'Youth program available for ages 13–18; contact the club for current session details.',
  'patrol': 'Typically Saturday and Sunday afternoons and public holidays during the patrol season.',
  'sports': ['Boards',
             'Beach sprints and flags',
             'Swimming',
             'Ski paddling',
             'Surf boats',
             'Inflatable Rescue Boat racing',
             'Pool rescue'],
  'sports_support': True,
  'adaptive': 'Adaptive Nippers program for children aged 7–13 with a disability.',
  'multicultural': None,
  'first_nations': None,
  'other_programs': ['Silver Salties 65+'],
  'facilities_text': ['Gym', 'Restaurant', 'Accessible toilet/changerooms'],
  'fees': [{'name': 'New active member 18+',
            'description': 'Patrolling member or member training for the Surf Rescue Certificate/Bronze Medallion.',
            'price': '$210'},
           {'name': 'Social member',
            'description': 'For members who want to participate in the club without patrolling.',
            'price': '$50–$60'},
           {'name': 'Family membership',
            'description': '2 adults and 2 children under 18; additional children under 18 are $10 each.',
            'price': '$345'},
           {'name': 'Under 18',
            'description': 'Ages 5–13 plus an adult: $240–$280. Ages 13–18: $140.',
            'price': '$140–$280'}],
  'fee_note': '2026/27 fees supplied by the club. Additional competition or program costs may apply.',
  'summary': 'A southern coastal club at Aldinga Beach offering Nippers, patrols, surf sports, an adaptive junior '
             'program and Silver Salties.',
  'best_for': ['Families in the southern suburbs and Fleurieu',
               'Children starting Nippers',
               'Members interested in lifesaving, surf sports or inclusive junior participation',
               'Older adults interested in Silver Salties'],
  'clarifications': ["The supplied visit text contained template wording ('e.g. Saturdays from…'). It has been removed "
                     'and the club’s actual Saturday/Sunday patrol-season guidance retained.'],
  'built': ["Expanded the supplied club name 'Aldinga Bay' to the existing official page title.",
            "Converted the supplied S/M/L membership category to 'Medium (201–400 members)'."]},
 {'title': 'Beachport Surf Life Saving Club',
  'slug': 'beachport-slsc',
  'source_document': 'Beachport Club Information Page.docx',
  'address': 'Millicent Rd, Beachport SA 5280',
  'website': 'https://beachportslsc.com.au/',
  'size': 'Small',
  'contact_name': None,
  'contact_email': 'beachportslssa@gmail.com',
  'visit': 'Visit during Nippers or Youth sessions, or contact the club by email before attending.',
  'nippers': 'Most Sundays from December to February, 10:00 am–11:30 am.',
  'youth': 'Youth sessions follow Nippers and generally continue until 1:00 pm.',
  'patrol': 'Typically Saturdays and Sundays between Boxing Day and Australia Day.',
  'sports': [],
  'sports_support': False,
  'adaptive': None,
  'multicultural': None,
  'first_nations': None,
  'other_programs': [],
  'facilities_text': ['Accessible public toilets (no changerooms)', 'Accessible beach access'],
  'fees': [{'name': 'New active member 18+',
            'description': 'Patrolling member or member training for the Surf Rescue Certificate/Bronze Medallion.',
            'price': '$70'},
           {'name': 'Social member',
            'description': 'For members who want to participate in the club without patrolling.',
            'price': '$10'},
           {'name': 'Family membership', 'description': '2 adults and children under 21.', 'price': '$150'},
           {'name': 'Under 18', 'description': 'Anyone aged 5–18.', 'price': '$70'}],
  'fee_note': '2026/27 fees supplied by the club. Additional competition or program costs may apply.',
  'summary': 'A small Limestone Coast club offering summer Nippers, youth activities and seasonal patrols at '
             'Beachport.',
  'best_for': ['Families on the Limestone Coast',
               'Children and teenagers looking for a summer lifesaving program',
               'Members wanting a small community-based club'],
  'clarifications': ['The Club Registrar was listed as TBC pending the AGM on 30 August 2026, so no personal contact '
                     'name is published.',
                     'No surf-sports disciplines were ticked in the supplied information.'],
  'built': ['Used the club email as the primary joining contact until the registrar appointment is confirmed.']},
 {'title': 'Brighton Surf Life Saving Club',
  'slug': 'brighton-slsc',
  'source_document': 'Brighton Club Information Page.docx',
  'address': '147 Esplanade, Brighton SA 5048',
  'website': 'https://www.brightonsurfclub.com/',
  'size': 'Large',
  'contact_name': 'Ali Saunders',
  'contact_email': 'registrarinfo@brightonsurfclub.com',
  'visit': 'The club is open Friday evenings from 5:00 pm and Sundays from 3:00 pm. During the summer Nippers season '
           'it is also open on Saturday afternoons.',
  'nippers': 'Saturdays 2:00 pm–4:00 pm.',
  'youth': 'Youth program available for ages 13–18; contact the club for current session details.',
  'patrol': 'Typically Saturday and Sunday afternoons.',
  'sports': ['Boards',
             'Beach sprints and flags',
             'Swimming',
             'Ski paddling',
             'Surf boats',
             'Inflatable Rescue Boat racing',
             'Pool rescue'],
  'sports_support': True,
  'adaptive': None,
  'multicultural': None,
  'first_nations': None,
  'other_programs': [],
  'facilities_text': ['Gym (award holders only)', 'Restaurant', 'Accessible toilet/changerooms'],
  'fees': [{'name': 'New active member 18+',
            'description': 'Patrolling member or member training for the Surf Rescue Certificate/Bronze Medallion.',
            'price': '$200'},
           {'name': 'Social member',
            'description': 'For members who want to participate in the club without patrolling.',
            'price': '$60'},
           {'name': 'Family membership', 'description': '2 adults and all children under 14.', 'price': '$400'},
           {'name': 'Under 18',
            'description': 'Age 5–6 plus one adult: $150; age 7–12 plus one adult: $230; age 13–18: $200.',
            'price': '$150–$230'}],
  'fee_note': '2026/27 fees supplied by the club. Additional competition or program costs may apply.',
  'summary': 'A large metropolitan club at Brighton offering Nippers, patrols, a broad surf-sports program and member '
             'facilities.',
  'best_for': ['Families in Adelaide’s southern coastal suburbs',
               'Members interested in a broad surf-sports program',
               'People looking for regular club activity and lifesaving pathways'],
  'clarifications': [],
  'built': ['Removed unused template wording from the visit information and retained the actual club opening times.']},
 {'title': 'Chiton Rocks Surf Life Saving Club',
  'slug': 'chiton-rocks-slsc',
  'source_document': 'Chiton Club Information Page (003).docx',
  'address': 'Lot 440 Hindmarsh Esplanade, Hayborough SA 5211',
  'website': 'https://www.chitonrocks.com/',
  'size': 'Small',
  'contact_name': None,
  'contact_email': 'membership@chitonrocks.com',
  'secondary_email': 'chitonrocks@gmail.com',
  'visit': 'Prospective members can generally visit from 1:00 pm on Saturdays. Contact the membership team before '
           'attending.',
  'nippers': 'Saturdays from 2:00 pm.',
  'youth': 'Youth program available for ages 13–18; contact the club for current session details.',
  'patrol': 'Typically Saturday and Sunday afternoons.',
  'sports': ['Surf boats', 'Inflatable Rescue Boat racing'],
  'sports_support': True,
  'adaptive': None,
  'multicultural': None,
  'first_nations': None,
  'other_programs': [],
  'facilities_text': ['Gym', 'Restaurant', 'Accessible toilet/changerooms'],
  'fees': [{'name': 'New active member 18+',
            'description': 'Patrolling member or member training for the Surf Rescue Certificate/Bronze Medallion.',
            'price': '$80'},
           {'name': 'Social member',
            'description': 'Price varies depending on social membership type.',
            'price': '$80–$90'},
           {'name': 'Family membership', 'description': '2 adults and children under 18.', 'price': '$200'},
           {'name': 'Under 18', 'description': 'Age 5–13 plus one adult: $130; age 13–18: $70.', 'price': '$70–$130'}],
  'fee_note': '2026/27 fees supplied by the club. Additional competition or program costs may apply.',
  'summary': 'A small Fleurieu club at Hayborough offering Nippers, patrols, surf boat and IRB racing pathways and '
             'community volunteering.',
  'best_for': ['Families around Victor Harbor and Hayborough',
               'Members interested in surf boats or IRB racing',
               'People looking for a smaller volunteer-led coastal club'],
  'clarifications': ["The supplied contact name appears as 'Natash Tully'. The club’s current public committee page "
                     'lists a different membership manager name, so the script deliberately uses the role/email rather '
                     'than publishing an uncertain person name.',
                     'The supplied visit field included template wording; the usable Saturday 1:00 pm detail has been '
                     'retained.'],
  'built': ['Selected membership@chitonrocks.com as the primary joining email because it is role-specific; '
            'chitonrocks@gmail.com is retained as a secondary email.']},
 {'title': 'Christies Beach Surf Life Saving Club',
  'slug': 'christies-beach-slsc',
  'source_document': 'Christies Club Information Page.docx',
  'address': '32 Esplanade, Christies Beach SA',
  'website': 'https://www.christiesbeachslsc.com.au/',
  'size': 'Medium',
  'contact_name': 'Richard Nurmi',
  'contact_email': 'join@christiesbeachslsc.com.au',
  'visit': 'Email the club to arrange a walkthrough and discuss membership options.',
  'nippers': 'Saturdays 1:00 pm–4:00 pm.',
  'youth': 'Youth program available for ages 13–18; contact the club for current session details.',
  'patrol': 'Typically Saturday and Sunday afternoons.',
  'sports': ['Boards',
             'Beach sprints and flags',
             'Swimming',
             'Ski paddling',
             'Surf boats',
             'Inflatable Rescue Boat racing',
             'Pool rescue'],
  'sports_support': True,
  'adaptive': None,
  'multicultural': None,
  'first_nations': None,
  'other_programs': [],
  'facilities_text': ['Gym (active volunteering members only)', 'Accessible toilet/changerooms'],
  'fees': [{'name': 'New active member 18+',
            'description': 'Patrolling member or member training for SLS Observer, Surf Rescue Certificate or Bronze '
                           'Medallion.',
            'price': '$180'},
           {'name': 'Social member',
            'description': 'For members who want to participate in the club without patrolling.',
            'price': '$75'},
           {'name': 'Family membership',
            'description': '2 adults and all children under 25. SA Sports Vouchers accepted for eligible children up '
                           'to 18.',
            'price': '$320'},
           {'name': 'Under 18',
            'description': 'Ages 5–18, including up to 2 parent/caregiver memberships. SA Sports Vouchers can be used '
                           'toward the fee.',
            'price': '$220'},
           {'name': 'Active Over 50',
            'description': 'Active member holding or training for an SLS award.',
            'price': '$50'}],
  'fee_note': '2026/27 fees supplied by the club. Valid SA Sports Vouchers are accepted toward eligible junior '
              'membership fees.',
  'summary': 'A medium-sized southern metropolitan club offering Nippers, patrols, surf sports, training and active '
             'volunteering pathways.',
  'best_for': ['Families around Christies Beach and Onkaparinga',
               'Members wanting both lifesaving and surf-sports pathways',
               'Adults returning to active lifesaving'],
  'clarifications': [],
  'built': ['Standardised the membership descriptions and Sports Voucher wording without changing the supplied fee '
            'amounts.']},
 {'title': 'Elizabeth Life Saving Club',
  'slug': 'elizabeth-lsc',
  'source_document': 'Elizabeth Club Information Page.docx',
  'address': '1 Crockerton Rd, Elizabeth SA 5112',
  'website': 'https://elizabethlifesavingclub.org/',
  'size': 'Small',
  'contact_name': None,
  'contact_email': None,
  'visit': 'Prospective members can visit on Sunday mornings between 9:15 am and 12:00 pm.',
  'nippers': 'Pool-based water-safety lessons are offered for infants through to teenagers.',
  'youth': 'Teenagers are included in the club’s pool-based water-safety program.',
  'patrol': None,
  'sports': ['Pool rescue'],
  'sports_support': False,
  'adaptive': None,
  'multicultural': None,
  'first_nations': None,
  'other_programs': ['Pool-based water-safety lessons for infants to teenagers'],
  'facilities_text': ['Accessible toilet/changerooms'],
  'fees': [],
  'fee_note': 'The club has asked that membership prices not be published publicly. Contact the club directly for '
              'current fees and availability.',
  'summary': 'A small pool-based life saving club in Elizabeth focused on water-safety education and pool rescue for '
             'children and teenagers.',
  'best_for': ['Families in Adelaide’s northern suburbs',
               'Children and teenagers looking for pool-based water-safety skills',
               'People interested in pool rescue rather than beach-based programs'],
  'clarifications': ['No new-member contact name or email address was supplied.',
                     'The club specifically asked that membership prices not be published because of program demand '
                     'and waitlists.'],
  'built': ['Used the club website as the contact pathway instead of inventing a personal contact.',
            'Mapped the junior age audience into the site’s existing age-group structure even though the program is '
            'pool-based rather than a traditional Nippers program.']},
 {'title': 'Glenelg Surf Life Saving Club',
  'slug': 'glenelg-slsc',
  'source_document': 'Glenelg Club Information Page.docx',
  'address': '20 Holdfast Promenade, Glenelg SA 5045',
  'website': 'https://www.glenelgslsc.com.au/',
  'size': 'Large',
  'contact_name': 'Neville Brookes',
  'contact_email': 'secretary@glenelgslsc.com.au',
  'visit': 'Contact the club to arrange an appointment with someone who can discuss membership.',
  'nippers': 'Saturdays 2:00 pm–4:00 pm. Winter training is also listed on Sundays from 3:00 pm.',
  'youth': 'Winter youth training is underway, with mid-week and Saturday sessions plus other catch-ups.',
  'patrol': 'Typically Saturday and Sunday afternoons.',
  'sports': ['Boards', 'Beach sprints and flags', 'Swimming', 'Ski paddling', 'Surf boats', 'Pool rescue'],
  'sports_support': True,
  'adaptive': 'The club is seeking expressions of interest to establish an adaptive program for participants with '
              'diverse needs.',
  'multicultural': 'Education and awareness days can be delivered for multicultural community groups on request.',
  'first_nations': None,
  'other_programs': ['Year-round swimming on Tuesday and Thursday evenings',
                     'IRB racing with dedicated Nipper and Senior programs'],
  'facilities_text': ['Gym', 'Restaurant', 'Accessible toilet/changerooms', 'Accessible beach access'],
  'fees': [{'name': 'New active member 15+',
            'description': 'Patrolling member or member training for the Surf Rescue Certificate/Bronze Medallion; '
                           'includes bar and bistro member discounts.',
            'price': '$190'},
           {'name': 'Social member',
            'description': 'For members who want to participate in the club without patrolling.',
            'price': '$80'},
           {'name': 'Family membership',
            'description': '2 adults and up to 4 children; includes bar and bistro member discounts.',
            'price': '$400'},
           {'name': 'Child aged 5–7', 'description': 'Parent must also hold a membership.', 'price': '$120'},
           {'name': 'Child aged 7–13', 'description': 'Parent must also hold a membership.', 'price': '$170'},
           {'name': 'Child aged 13–15',
            'description': 'The supplied document contains a corrupted fee value and requires confirmation.',
            'price': 'To be confirmed'}],
  'fee_note': 'The supplied document says 2026/27 membership pricing was still to be confirmed in August. Treat listed '
              'amounts as provisional until confirmed by the club.',
  'summary': 'A large metropolitan club at Glenelg offering Nippers, patrols, broad surf-sports pathways, year-round '
             'swimming and member facilities.',
  'best_for': ['Families around Glenelg and the western/south-western suburbs',
               'Members wanting a broad surf-sports program',
               'People interested in year-round swimming and lifesaving'],
  'clarifications': ['The supplied document says membership pricing is TBC in August.',
                     "The 13–15 junior fee is corrupted in the source ('190245') and has not been guessed."],
  'built': ["Corrected the supplied contact spelling from 'Neville Brrookes' to 'Neville Brookes' after checking "
            'Glenelg SLSC public AGM material.',
            "Converted the adaptive-program wording into a clear 'expressions of interest' status rather than "
            'presenting it as an established program.']},
 {'title': 'Goolwa Surf Life Saving Club',
  'slug': 'goolwa-slsc',
  'source_document': 'Goolwa Club Information Page.docx',
  'address': '1 Beach Rd, Goolwa Beach SA 5214',
  'website': 'https://goolwaslsc.com.au/',
  'size': 'Small',
  'contact_name': 'Matthew Burrage',
  'contact_email': 'info@goolwaslsc.com.au',
  'phone': '0402 006 784',
  'visit': 'During the patrol season, prospective members can visit from 12:00 pm on Saturdays or throughout Sunday. '
           'You can also contact the club before attending.',
  'nippers': 'Sundays 9:45 am–12:00 pm.',
  'youth': 'Youth program available for ages 13–18; contact the club for current session details.',
  'patrol': 'Typically Saturday and Sunday afternoons.',
  'sports': ['Boards', 'Beach sprints and flags', 'Surf boats', 'Inflatable Rescue Boat racing'],
  'sports_support': True,
  'adaptive': None,
  'multicultural': None,
  'first_nations': None,
  'other_programs': [],
  'facilities_text': ['Restaurant', 'Accessible toilet/changerooms'],
  'fees': [{'name': 'New active member 18+',
            'description': 'Patrolling member or member training for the Surf Rescue Certificate/Bronze Medallion.',
            'price': '$150'},
           {'name': 'Social member',
            'description': 'For members who want to participate in the club without patrolling.',
            'price': '$80'},
           {'name': 'Family membership', 'description': '2 adults and 2 children.', 'price': '$350'},
           {'name': 'Under 18', 'description': 'Age 5–13 plus one adult: $180; age 13–17: $80.', 'price': '$80–$180'}],
  'fee_note': 'The club marked membership pricing as under review. Listed amounts should be confirmed before relying '
              'on them for 2026/27.',
  'summary': 'A small Fleurieu club at Goolwa Beach offering Nippers, patrols, surf boats, IRB racing and community '
             'participation.',
  'best_for': ['Families around Goolwa and the lower Fleurieu',
               'Members interested in surf boats or IRB racing',
               'People looking for a small coastal club'],
  'clarifications': ["Membership and pricing is explicitly marked 'UNDER REVIEW' in the supplied document."],
  'built': ['Removed template wording from the visit information and retained the supplied patrol-season '
            'availability.']},
 {'title': 'Grange Surf Life Saving Club',
  'slug': 'grange-slsc',
  'source_document': 'Grange Club Information Page.docx',
  'address': '497 Esplanade, Grange SA 5022',
  'website': 'https://www.grangeslsc.asn.au/',
  'size': 'Large',
  'contact_name': 'Elodie Derlique (Registrar)',
  'contact_email': 'mail@grangeslsc.asn.au',
  'visit': 'The Registrar can arrange meetings with prospective members outside business hours. The club is generally '
           'open Friday nights from 6:00 pm. During October–March, Nippers run Saturdays 1:00 pm–3:00 pm and patrol '
           'members may also be available on weekends from 12:00 pm–5:00 pm.',
  'nippers': 'Saturdays 1:00 pm–3:00 pm.',
  'youth': 'Youth program available for ages 13–18; contact the club for current session details.',
  'patrol': 'Typically Saturday and Sunday afternoons.',
  'sports': ['Boards', 'Beach sprints and flags', 'Swimming', 'Ski paddling', 'Surf boats', 'Pool rescue'],
  'sports_support': True,
  'adaptive': None,
  'multicultural': None,
  'first_nations': None,
  'other_programs': [],
  'facilities_text': ['Gym', 'Restaurant', 'Accessible toilet/changerooms'],
  'fees': [{'name': 'New active member 15+',
            'description': 'Patrolling member or member training for the Surf Rescue Certificate/Bronze Medallion.',
            'price': '$260'},
           {'name': 'Competing member',
            'description': 'Patrolling member involved in competitions. U15: $330; U17+: $370.',
            'price': '$330–$370'},
           {'name': 'Social member',
            'description': 'For members who want to participate in the club without patrolling.',
            'price': '$75'},
           {'name': 'Family membership',
            'description': 'Families of 4 or more receive a 15% discount from the combined individual total.',
            'price': '15% family discount'},
           {'name': 'Under 15',
            'description': 'Age 5–6 plus adult: $185; age 7–13 plus adult: $285; age 13–14: $330.',
            'price': '$185–$330'}],
  'fee_note': '2026/27 fees supplied by the club. Competition fees include SLSSA carnivals and state titles where '
              'specified.',
  'summary': 'A large western metropolitan club offering Nippers, patrols, surf sports, pool rescue and strong '
             'competition pathways.',
  'best_for': ['Families in Adelaide’s western suburbs',
               'Members interested in competition and surf sports',
               'People seeking both lifesaving and social club involvement'],
  'clarifications': [],
  'built': ['Combined the separate visit notes into one clear prospective-member visiting section.']},
 {'title': 'Henley Surf Life Saving Club',
  'slug': 'henley-slsc',
  'source_document': 'Henley Club Information Page (1).docx',
  'address': '246 Esplanade, Henley Beach SA 5022',
  'website': 'https://www.henleyslsc.com.au/',
  'size': 'Medium',
  'contact_name': 'Ewa Poczman',
  'contact_email': 'info@henleyslsc.com.au',
  'visit': 'Visit on Saturdays between 9:00 am and 10:00 am. Enter from the beach side via the ramp and head to the '
           'deck, where the Saturday morning group can help with joining questions.',
  'nippers': 'October–March: Saturdays 12:45 pm, with mid-week training Thursdays at 4:30 pm. From April–August, '
             'Nippers aged 11+ are encouraged to join pool rescue training on Saturday afternoons. Nippers swim '
             'training runs year-round on Thursdays at 7:30 pm at Seaton Swim Centre.',
  'youth': 'Youth program available for ages 13–18.',
  'patrol': 'Typically Saturday and Sunday afternoons, with around five rostered shifts per member each season. Full '
            'training is provided and previous lifesaving experience is not required.',
  'sports': ['Boards', 'Beach sprints and flags', 'Swimming', 'Ski paddling', 'Surf boats', 'Pool rescue'],
  'sports_support': True,
  'adaptive': 'Adaptive program available.',
  'multicultural': 'Multicultural program available.',
  'first_nations': 'First Nations program available.',
  'other_programs': [],
  'facilities_text': ['Gym', 'Restaurant', 'Accessible toilet/changerooms', 'Accessible beach access'],
  'fees': [{'name': 'New active member 18+',
            'description': 'Patrolling member or member training for the Surf Rescue Certificate/Bronze Medallion.',
            'price': '$200'},
           {'name': 'Social member',
            'description': 'For members who want to participate in the club without patrolling.',
            'price': '$50'},
           {'name': 'Family membership',
            'description': 'Maximum combined fee for members living in one household.',
            'price': '$440'},
           {'name': 'Child aged 6–7',
            'description': 'Includes social membership for 2 parents/guardians.',
            'price': '$100'},
           {'name': 'Child aged 8–13',
            'description': 'Includes social membership for 2 parents/guardians.',
            'price': '$150'},
           {'name': 'Youth aged 13–18',
            'description': 'Includes social membership for 2 parents/guardians and competition fees for SA carnivals; '
                           'craft and training subsidies are available.',
            'price': '$150'},
           {'name': 'Adaptive Nippers',
            'description': 'Includes social membership for 2 parents/guardians.',
            'price': '$100'}],
  'fee_note': '2026/27 fees supplied by the club. Additional costs may apply depending on the member’s activities.',
  'summary': 'A metropolitan club at Henley Beach offering Nippers, patrols, year-round training, surf sports and '
             'inclusive participation programs.',
  'best_for': ['Families in Adelaide’s western suburbs',
               'New lifesavers who want training and a clear patrol pathway',
               'Members interested in year-round junior training',
               'People looking for adaptive, multicultural or First Nations participation pathways'],
  'clarifications': [],
  'built': ['Condensed the club’s detailed training and patrol explanation while retaining the supplied times and '
            'approximately five patrol shifts per member.']},
 {'title': 'Moana Surf Life Saving Club',
  'slug': 'moana-slsc',
  'source_document': 'Moana Club Information Page.docx',
  'address': 'Esplanade, Moana SA 5169',
  'website': 'https://moanaslsc.com.au/',
  'size': 'Medium',
  'contact_name': 'Peter Kerrison',
  'contact_email': 'president@moanaslsc.com.au',
  'visit': 'During the patrol season, the club registrar is generally at the club on Saturday afternoons. Contact the '
           'club before attending if you would like to arrange a specific time.',
  'nippers': 'Saturdays 1:30 pm–4:00 pm.',
  'youth': 'Youth program available for ages 13–18; contact the club for current session details.',
  'patrol': 'Typically Saturday and Sunday afternoons.',
  'sports': ['Boards',
             'Beach sprints and flags',
             'Swimming',
             'Ski paddling',
             'Surf boats',
             'Inflatable Rescue Boat racing'],
  'sports_support': True,
  'adaptive': 'Disabled surfing is offered on selected Sundays in October, February and March.',
  'multicultural': None,
  'first_nations': None,
  'other_programs': ['Wellness Tuesday, Tuesdays 1:00 pm–3:00 pm, a community music and social activity'],
  'facilities_text': ['Gym', 'Restaurant', 'Accessible toilet/changerooms', 'Accessible beach access'],
  'fees': [{'name': 'New active member 13+',
            'description': 'Patrolling member or member training for the Surf Rescue Certificate/Bronze Medallion.',
            'price': '$140'},
           {'name': 'Social member',
            'description': 'For members who want to participate in the club without patrolling.',
            'price': '$70'},
           {'name': 'Family membership', 'description': '2 adults and any children under 18.', 'price': '$320'},
           {'name': 'Under 14',
            'description': 'Age 5–13, including one complimentary guardian membership.',
            'price': '$100'}],
  'fee_note': '2026/27 fees supplied by the club. Additional competition or program costs may apply.',
  'summary': 'A southern metropolitan club offering Nippers, patrols, broad surf sports, accessible facilities and '
             'community programs.',
  'best_for': ['Families around Moana and the southern suburbs',
               'Members wanting a broad surf-sports program',
               'People interested in community and inclusive activities'],
  'clarifications': ['The adaptive-program sentence in the source is grammatically unclear about the exact Sunday '
                     'dates.'],
  'built': ['Interpreted the adaptive-program wording as selected Sundays in October, February and March rather than '
            'claiming every Sunday.',
            "Cleaned the contact-name formatting ('Peter KerrisonName')."]},
 {'title': 'Murray Bridge Life Saving Club',
  'slug': 'murray-bridge-lsc',
  'source_document': 'Murray Bridge Club Information Page.docx',
  'address': 'Sturt Reserve, Murray Bridge SA',
  'website': 'https://www.mblsc.com.au/',
  'size': 'Small',
  'contact_name': 'Erin Scammell',
  'contact_email': 'murraybridgelifesavingclub@gmail.com',
  'visit': 'Visit during Nipper sessions. Current session times should be confirmed with the club.',
  'nippers': 'Nippers program available; the supplied 2026/27 session time is blank and should be confirmed with the '
             'club.',
  'youth': 'Youth program available for ages 13–18; session times should be confirmed with the club.',
  'patrol': None,
  'sports': ['Boards', 'Beach sprints and flags', 'Swimming'],
  'sports_support': True,
  'adaptive': None,
  'multicultural': None,
  'first_nations': None,
  'other_programs': ['Future Lifesavers'],
  'facilities_text': ['Operates at Sturt Reserve with no permanent club facilities at this stage'],
  'fees': [{'name': 'New active member 16+',
            'description': 'Patrolling member or member training for the Surf Rescue Certificate/Bronze Medallion.',
            'price': '$75'},
           {'name': 'Founding member', 'description': 'Club membership category.', 'price': '$40'},
           {'name': 'Supporter member', 'description': 'Club supporter membership.', 'price': '$20'},
           {'name': 'Family membership', 'description': 'Not available.', 'price': 'Not available'},
           {'name': 'Under 16', 'description': 'Age 5–13: $60; age 13–16: $60.', 'price': '$60'}],
  'fee_note': '2026/27 fees supplied by the club. Additional competition or program costs may apply.',
  'summary': 'An inland life saving club at Sturt Reserve offering junior and youth programs, surf-sport skills and '
             'community volunteering.',
  'best_for': ['Families in Murray Bridge and the Murraylands',
               'Children interested in life saving and surf-sport skills in an inland setting',
               'Members looking for a small community club'],
  'clarifications': ['The document says to visit during Nipper sessions but does not provide the Nipper session time.',
                     'The club notes that it operates at Sturt Reserve without permanent facilities.'],
  'built': ["Used 'contact the club for current times' rather than inventing a Nipper schedule.",
            "Kept the official 'Life Saving Club' naming and used the shorter '-lsc' slug rather than '-slsc'."]},
 {'title': 'Normanville Surf Life Saving Club',
  'slug': 'normanville-slsc',
  'source_document': 'Normanville Club Information Page.docx',
  'address': 'Jetty Rd, Normanville SA 5204',
  'website': 'https://normanvilleslsc.org.au/',
  'size': 'Small',
  'contact_name': 'Bec Heath',
  'contact_email': 'registrar@normanvilleslsc.org.au',
  'visit': 'Prospective members can generally visit on Saturdays from 2:00 pm. Contact the club before attending if '
           'you would like to arrange a specific time.',
  'nippers': 'Saturdays 2:00 pm–4:00 pm.',
  'youth': 'Youth program available for ages 13–18; contact the club for current session details.',
  'patrol': 'Typically Saturday and Sunday afternoons.',
  'sports': ['Boards', 'Ski paddling', 'Surf boats', 'Inflatable Rescue Boat racing'],
  'sports_support': True,
  'adaptive': 'Neurodivergent Nippers program available.',
  'multicultural': None,
  'first_nations': None,
  'other_programs': [],
  'facilities_text': ['Gym (active members only)',
                      'Restaurant',
                      'Accessible toilet/changerooms',
                      'Accessible beach access'],
  'fees': [{'name': 'New active member 18+',
            'description': 'Patrolling member or member training for the Surf Rescue Certificate/Bronze Medallion.',
            'price': '$120'},
           {'name': 'Social/community member',
            'description': 'For members who want to participate in the club without patrolling.',
            'price': '$50'},
           {'name': 'Family membership',
            'description': '2 adults and 2 children under 18; additional children $25 each.',
            'price': '$200'},
           {'name': 'Under 18', 'description': 'Over 13, or under 25 while in full-time education.', 'price': '$65'}],
  'fee_note': 'The supplied fee schedule was awaiting a membership vote at the 23 August 2026 AGM and should be '
              'confirmed before publication as final 2026/27 pricing.',
  'summary': 'A small Fleurieu club at Normanville offering Nippers, patrols, surf sports, accessible facilities and a '
             'neurodivergent junior program.',
  'best_for': ['Families around Normanville and Yankalilla',
               'Members interested in surf boats, ski paddling or IRB racing',
               'Families looking for a neurodivergent Nippers pathway'],
  'clarifications': ['The supplied document says the club intended to increase fees for 2026/27 subject to a vote at '
                     'the 23 August 2026 AGM. Final post-AGM fees are not in the document.'],
  'built': ["Cleaned the visit field from 'e.g. Saturdays from 2pm to 4pm 2pm' to a clear Saturday-from-2:00-pm "
            'statement.']},
 {'title': 'Port Elliot Surf Life Saving Club',
  'slug': 'port-elliot-slsc',
  'source_document': 'Port Elliot Club Information Page.docx',
  'address': '1 The Cutting, Port Elliot SA 5212',
  'website': 'https://portelliotslsc.com.au/',
  'size': 'Large',
  'contact_name': None,
  'contact_email': 'info@portelliotslsc.com.au',
  'visit': 'The club indicates Saturdays from approximately 1:00 pm–2:00 pm between October and April, but recommends '
           'email as the best way to arrange a membership discussion.',
  'nippers': 'Saturdays 1:00 pm–3:00 pm.',
  'youth': 'Youth program available for ages 13–18; contact the club for current session details.',
  'patrol': 'Typically Saturday, Sunday and public-holiday afternoons.',
  'sports': ['Boards', 'Beach sprints and flags', 'Ski paddling', 'Surf boats'],
  'sports_support': True,
  'adaptive': 'Adaptive program available.',
  'multicultural': None,
  'first_nations': None,
  'other_programs': [],
  'facilities_text': ['Gym', 'Restaurant', 'Accessible toilet/changerooms'],
  'fees': [{'name': 'New active member 18+',
            'description': 'Patrolling member or member training for the Surf Rescue Certificate/Bronze Medallion.',
            'price': '$210'},
           {'name': 'Social member', 'description': 'No changeroom or gym access.', 'price': '$55'},
           {'name': 'Family membership',
            'description': '2 adults + 2 children, or 1 adult + 3 children.',
            'price': '$520'},
           {'name': 'Under 18', 'description': 'Children aged 5–17.', 'price': '$100'},
           {'name': 'Associate (Nipper parent)', 'description': 'Parent/associate membership.', 'price': '$40'}],
  'fee_note': '2026/27 fees supplied by the club. Additional competition or program costs may apply.',
  'summary': 'A large Fleurieu club at Port Elliot offering Nippers, patrols, surf-sports pathways, an adaptive '
             'program and member facilities.',
  'best_for': ['Families around Port Elliot and the Fleurieu',
               'Members interested in patrols, surf boats and ski paddling',
               'People seeking an adaptive participation pathway'],
  'clarifications': ['No personal new-member contact name was supplied.',
                     'The visit note says email is preferable even though a Saturday 1:00–2:00 pm window is also '
                     'given.'],
  'built': ['Used the role-based info@ email as the primary joining contact.']},
 {'title': 'Port Noarlunga Surf Life Saving Club',
  'slug': 'port-noarlunga-slsc',
  'source_document': 'Port Noarlunga Club Information Page.docx',
  'address': 'Cnr Saltfleet St & Esplanade, Port Noarlunga SA 5167',
  'website': 'https://pnslsc.com.au/',
  'size': 'Medium',
  'contact_name': 'Port Noarlunga Club Secretary',
  'contact_email': 'secretary@pnslsc.com.au',
  'visit': 'Visit on Saturdays or Sundays from 1:00 pm, or arrange another time by emailing the Club Secretary.',
  'nippers': 'Saturdays 9:30 am–12:00 pm.',
  'youth': 'No specific youth program is currently listed.',
  'patrol': 'Typically Saturday and Sunday afternoons.',
  'sports': ['Boards',
             'Beach sprints and flags',
             'Swimming',
             'Ski paddling',
             'Surf boats',
             'Inflatable Rescue Boat racing',
             'Pool rescue'],
  'sports_support': True,
  'adaptive': 'No specific adaptive program is currently listed.',
  'multicultural': 'No specific multicultural program is currently listed.',
  'first_nations': 'No specific First Nations program is currently listed.',
  'other_programs': [],
  'facilities_text': ['Gym', 'Restaurant', 'Accessible toilet/changerooms'],
  'fees': [{'name': 'New active member 14+',
            'description': 'Patrolling member or member training for the Surf Rescue Certificate/Bronze Medallion.',
            'price': '$150'},
           {'name': 'Social member',
            'description': 'For members who want to participate in the club without patrolling.',
            'price': '$60'},
           {'name': 'Family membership', 'description': '2 adults and all children under 18.', 'price': '$310'},
           {'name': 'Under 14', 'description': 'Age 5–13, including guardian membership.', 'price': '$220'}],
  'fee_note': 'The supplied fees are 2025/26 rates. The document says the 2026/27 committee had not yet been '
              'established to review them.',
  'summary': 'A medium-sized southern metropolitan club offering Nippers, patrols, a broad surf-sports program and '
             'member facilities.',
  'best_for': ['Families around Port Noarlunga and Onkaparinga',
               'Members wanting a broad surf-sports program',
               'People interested in patrolling and lifesaving'],
  'clarifications': ['The supplied membership fees are explicitly 2025/26 rates and require 2026/27 confirmation.',
                     'No specific youth, adaptive, multicultural or First Nations programs are currently listed.'],
  'built': ['Removed the unused visit template wording and retained the actual weekend visiting guidance.']},
 {'title': 'Robe Surf Life Saving Club',
  'slug': 'robe-slsc',
  'source_document': 'Robe Club Information Page - Copy - Copy.docx',
  'address': None,
  'website': 'https://www.robesls.club/',
  'size': 'Small',
  'contact_name': None,
  'contact_email': 'contact@robesls.club',
  'visit': 'Visit on Saturdays from 10:00 am–12:00 pm during Nippers, or contact the club before attending.',
  'nippers': 'Saturdays 10:00 am–12:00 pm.',
  'youth': None,
  'patrol': 'Typically Saturday and Sunday afternoons.',
  'sports': ['Boards', 'Beach sprints and flags'],
  'sports_support': False,
  'adaptive': None,
  'multicultural': None,
  'first_nations': None,
  'other_programs': [],
  'facilities_text': [],
  'fees': [{'name': 'New active member 18+',
            'description': 'Patrolling member or member training for the Surf Rescue Certificate/Bronze Medallion.',
            'price': '$50'},
           {'name': 'Social member',
            'description': 'For members who want to participate in the club without patrolling.',
            'price': '$30'},
           {'name': 'Family membership', 'description': 'Minimum 1 adult and 2 children.', 'price': '$120'},
           {'name': 'Under 18', 'description': 'Age 5–18; ages 5–13 must be accompanied by an adult.', 'price': '$50'}],
  'fee_note': '2026/27 fees supplied by the club. Additional competition or program costs may apply.',
  'summary': 'A small Limestone Coast club offering Nippers, seasonal patrols and entry-level surf-sport activities in '
             'Robe.',
  'best_for': ['Families in Robe and the Limestone Coast',
               'Children starting Nippers',
               'Members wanting a small community lifesaving club'],
  'clarifications': ['The supplied document contains no street address and no named new-member contact.',
                     'No facilities were ticked in the supplied document.'],
  'built': ['The updater preserves the existing page address when the source document leaves it blank rather than '
            'inventing one.']},
 {'title': 'Seacliff Surf Life Saving Club',
  'slug': 'seacliff-slsc',
  'source_document': 'Seacliff Club Information Page - Copy - 2july26.docx',
  'address': '248 Esplanade, Seacliff SA 5049',
  'website': 'https://www.seacliffslsc.com.au/',
  'size': 'Large',
  'contact_name': None,
  'contact_email': 'secretary@seacliffslsc.com.au',
  'secondary_email': 'juniors@seacliffslsc.com.au',
  'visit': 'Email the club administration team to arrange a suitable time to discuss joining. For Juniors, prospective '
           'families can meet the team near the patrol tower on Saturday afternoons from 1:30 pm or contact the '
           'Juniors team by email.',
  'nippers': 'Saturdays from 1:30 pm; the supplied finish time is unclear and should be confirmed.',
  'youth': 'Youth program available for ages 13–18; contact the club for current session details.',
  'patrol': 'Typically Saturday and Sunday afternoons.',
  'sports': ['Boards',
             'Beach sprints and flags',
             'Swimming',
             'Ski paddling',
             'Surf boats',
             'Inflatable Rescue Boat racing',
             'Pool rescue'],
  'sports_support': True,
  'adaptive': None,
  'multicultural': None,
  'first_nations': None,
  'other_programs': [],
  'facilities_text': ['Gym', 'Restaurant', 'Accessible toilet/changerooms', 'Accessible beach access'],
  'fees': [{'name': 'New active member 19+',
            'description': 'Patrolling member or member training for the Surf Rescue Certificate/Bronze Medallion.',
            'price': '$200'},
           {'name': 'Social member',
            'description': 'For members who want to participate in the club without patrolling.',
            'price': '$60'},
           {'name': 'Family membership', 'description': '2 adults and children under 21.', 'price': '$580'},
           {'name': 'Under 19',
            'description': 'Age 5–6: $150; age 7–13: $220; age 14–18: $180.',
            'price': '$150–$220'}],
  'fee_note': '2026/27 fees supplied by the club. Additional competition or program costs may apply.',
  'summary': 'A large metropolitan club at Seacliff offering Nippers, patrols, broad surf sports, pool rescue and '
             'accessible facilities.',
  'best_for': ['Families in Adelaide’s south-western suburbs',
               'Members wanting a broad surf-sports program',
               'People interested in patrols, training and accessible club facilities'],
  'clarifications': ['The supplied contact note says the Secretary role was due to change after the 26 July AGM, so '
                     'the script uses the role-based email and does not publish the supplied person name.',
                     "The Nippers time is written as '1:30pm – 3:15 -4pm', so the finish time requires confirmation."],
  'built': ['Used the role-based secretary and juniors email addresses to avoid publishing a potentially outdated '
            'office-holder name.']},
 {'title': 'Semaphore Surf Life Saving Club',
  'slug': 'semaphore-slsc',
  'source_document': 'Semaphore Club Information Page.docx',
  'address': 'Point Malcolm Reserve, Military Rd, Semaphore Park SA 5019',
  'website': 'https://semaphoreslsc.com.au/',
  'size': 'Large',
  'contact_name': 'Steph Breden',
  'contact_email': 'registrar@semaphoreslsc.com.au',
  'visit': 'Prospective members can generally visit from 12:30 pm on Saturdays or contact the Registrar by email.',
  'nippers': 'Saturdays 12:45 pm–3:00 pm.',
  'youth': 'The club refers to its 13+ pathway as the Seniors program. Training runs from July through to the '
           'Australian Championships on multiple days of the week.',
  'patrol': 'Typically Saturday and Sunday afternoons.',
  'sports': ['Boards', 'Beach sprints and flags', 'Swimming', 'Ski paddling', 'Surf boats', 'Pool rescue'],
  'sports_support': True,
  'adaptive': 'Adaptive program available.',
  'multicultural': 'No current dedicated multicultural program is listed.',
  'first_nations': 'No current dedicated First Nations program is listed.',
  'other_programs': [],
  'facilities_text': ['Gym', 'Restaurant', 'Accessible toilet/changerooms', 'Accessible beach access'],
  'fees': [{'name': 'New active member 18+',
            'description': 'Patrolling member or member training for the Surf Rescue Certificate/Bronze Medallion.',
            'price': '$220'},
           {'name': 'Social/community member',
            'description': 'Price varies depending on membership type.',
            'price': '$100–$200'},
           {'name': 'Family membership', 'description': '2 adults and up to 4 children under 18.', 'price': '$650'},
           {'name': 'Under 18',
            'description': 'Age 5–7: $155; age 7–13: $250; age 13–18: $200.',
            'price': '$155–$250'}],
  'fee_note': '2026/27 fees supplied by the club. Additional competition or program costs may apply.',
  'summary': 'A large western metropolitan club offering Nippers, patrols, a Seniors pathway, broad surf sports and an '
             'adaptive program.',
  'best_for': ['Families in Adelaide’s north-western coastal suburbs',
               'Members interested in Nippers, Seniors and patrol pathways',
               'People looking for a broad surf-sports program and accessible facilities'],
  'clarifications': ["The document is marked 'UNOFFICIAL'.",
                     'IRB racing is marked as not available at this point in time.',
                     "The Multicultural and First Nations rows contain both an 'X' and 'NA at this point in time'; the "
                     "script follows the written 'NA' status and does not present them as active dedicated programs."],
  'built': ['Removed the visit template prefix and retained the supplied Saturday 12:30 pm guidance.']},
 {'title': 'Somerton Surf Life Saving Club',
  'slug': 'somerton-slsc',
  'source_document': 'Somerton Club Information Page.docx',
  'address': 'Esplanade & Repton Rd, Somerton Park SA 5044',
  'website': 'http://somertonsurfclub.com.au/wp/',
  'size': 'Large',
  'contact_name': 'Louise Lawson',
  'contact_email': 'secretary@somertonsurfclub.com.au',
  'visit': 'Club officers are typically at the club on Saturdays from 1:30 pm–4:00 pm.',
  'nippers': 'Saturdays 2:00 pm–4:00 pm.',
  'youth': 'Typically Saturdays from 2:00 pm.',
  'patrol': 'Typically Saturday and Sunday afternoons.',
  'sports': ['Boards',
             'Beach sprints and flags',
             'Swimming',
             'Ski paddling',
             'Surf boats',
             'Inflatable Rescue Boat racing',
             'Pool rescue'],
  'sports_support': True,
  'adaptive': 'Adaptive program available.',
  'multicultural': None,
  'first_nations': None,
  'other_programs': [],
  'facilities_text': ['Gym', 'Restaurant', 'Accessible toilet/changerooms'],
  'fees': [{'name': 'New active member 18+',
            'description': 'Patrolling member or member training for the Surf Rescue Certificate/Bronze Medallion.',
            'price': '$235 ($195 full-time student)'},
           {'name': 'Social member',
            'description': 'Price varies by social/community membership type.',
            'price': '$75'},
           {'name': 'Family membership',
            'description': 'Includes immediate family members aged 21 or younger, unless a full-time student.',
            'price': '$495'},
           {'name': 'Child aged 5–7', 'description': 'Includes guardian membership.', 'price': '$230'},
           {'name': 'Child aged 7–13', 'description': 'Includes guardian membership.', 'price': '$325'},
           {'name': 'Youth aged 13–18', 'description': 'Includes guardian non-award membership.', 'price': '$260'}],
  'fee_note': 'A 10% discount applies if paid before 31 October. Additional competition or program costs may apply.',
  'summary': 'A large metropolitan club at Somerton Park offering Nippers, youth activities, patrols, broad surf '
             'sports and an adaptive program.',
  'best_for': ['Families in Adelaide’s south-western coastal suburbs',
               'Members seeking strong surf-sports and patrol pathways',
               'People interested in adaptive participation'],
  'clarifications': ['The source summary says the under-18 range is $230–$315, but the detailed 7–13 fee is $325. The '
                     'script uses the detailed $325 figure and flags the conflict.'],
  'built': ['Used the detailed age-band prices instead of the inconsistent summary range.']}]

SIZE_LABELS = {
    "Small": "Small (0–200 members)",
    "Medium": "Medium (201–400 members)",
    "Large": "Large (401+ members)",
}

FRONT_MATTER_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*\n?", re.DOTALL)


def normalise(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def split_page(text: str) -> tuple[dict, str]:
    match = FRONT_MATTER_RE.match(text)
    if not match:
        raise ValueError("No YAML front matter found")
    meta = yaml.safe_load(match.group(1)) or {}
    body = text[match.end():]
    return meta, body


def dump_page(meta: dict, body: str) -> str:
    yaml_text = yaml.safe_dump(
        meta,
        sort_keys=False,
        allow_unicode=True,
        width=120,
        default_flow_style=False,
    ).rstrip()
    return f"---\n{yaml_text}\n---\n\n{body.rstrip()}\n"


def find_club_file(club_dir: Path, club: dict) -> Path | None:
    target = normalise(club["title"])
    candidates = []
    for path in sorted(club_dir.glob("*.md")):
        try:
            meta, _ = split_page(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        title = normalise(str(meta.get("title", "")))
        if title == target:
            return path
        # Safe fallback for pages whose title uses SLSC/LSC abbreviation.
        if title and (title in target or target in title):
            candidates.append(path)

    if len(candidates) == 1:
        return candidates[0]

    # Final filename fallback.
    keywords = [part for part in club["slug"].split("-") if part not in {"slsc", "lsc"}]
    filename_matches = [
        p for p in club_dir.glob("*.md")
        if all(k in p.stem.lower() for k in keywords[:2])
    ]
    return filename_matches[0] if len(filename_matches) == 1 else None


def derive_age_groups(club: dict) -> list[str]:
    groups = []
    if club.get("nippers"):
        groups.append("nippers")
    if club.get("youth"):
        groups.append("youth")
    if any("active" in f["name"].lower() for f in club.get("fees", [])) or club.get("patrol"):
        groups.append("adults")
    if any("family" in f["name"].lower() for f in club.get("fees", [])) or club.get("nippers"):
        groups.append("families")
    return groups


def derive_interests(club: dict) -> list[str]:
    interests = []
    if club.get("patrol"):
        interests.append("lifesaving-patrols")
    if club.get("nippers"):
        interests.append("nippers")
    if club.get("sports"):
        interests.append("surf-sports")
    if club.get("sports_support"):
        interests.append("volunteering")
    if club.get("nippers") or club.get("youth") or club.get("sports"):
        interests.append("training")
    interests.append("community")
    if club.get("adaptive") or club.get("multicultural") or club.get("first_nations"):
        interests.append("inclusive-programs")
    # Preserve order while removing duplicates.
    return list(dict.fromkeys(interests))


def verified_programs(club: dict) -> list[str]:
    programs = []
    if club.get("nippers"):
        if club["title"].startswith("Elizabeth "):
            programs.append("Pool-based water-safety program")
        else:
            programs.append("Nippers")
    if club.get("youth"):
        programs.append("Youth program")
    if club.get("patrol"):
        programs.append("Lifesaving and patrolling")
    programs.extend(club.get("sports", []))
    if club.get("sports_support"):
        programs.append("Surf sports support")
    if club.get("adaptive"):
        programs.append(club["adaptive"])
    if club.get("multicultural"):
        programs.append(club["multicultural"])
    if club.get("first_nations"):
        programs.append(club["first_nations"])
    programs.extend(club.get("other_programs", []))
    return list(dict.fromkeys(programs))


def membership_fee_note(club: dict) -> str:
    if not club.get("fees"):
        return club["fee_note"]
    compact = "; ".join(f'{f["name"]}: {f["price"]}' for f in club["fees"])
    return f"{compact}. {club['fee_note']}"


def infer_facility_tags(club: dict) -> list[str]:
    tags = []
    text = " ".join(club.get("facilities_text", [])).lower()
    if "accessible beach" in text:
        tags.append("beach-access")
    if "accessible" in text:
        tags.append("accessible-facilities")
    if "gym" in text:
        tags.append("gym")
    if "restaurant" in text:
        tags.append("restaurant")
    if club.get("nippers"):
        tags.append("family-friendly")
    return tags


def make_activity_details(club: dict) -> dict:
    data = {}
    if club.get("nippers"):
        data["junior"] = club["nippers"]
    if club.get("youth"):
        data["youth"] = club["youth"]
    if club.get("patrol"):
        data["lifesaving_patrolling"] = club["patrol"]
    if club.get("sports"):
        data["surf_sports"] = club["sports"]
    if club.get("sports_support"):
        data["surf_sports_support"] = True
    if club.get("adaptive"):
        data["adaptive"] = club["adaptive"]
    if club.get("multicultural"):
        data["multicultural"] = club["multicultural"]
    if club.get("first_nations"):
        data["first_nations"] = club["first_nations"]
    if club.get("other_programs"):
        data["other_programs"] = club["other_programs"]
    return data


def render_body(club: dict, existing_address: str | None = None) -> str:
    lines = []

    lines += [
        "## Overview",
        "",
        club["summary"],
        "",
        "## What this club offers",
        "",
    ]

    offers = []
    if club.get("nippers"):
        label = "Pool-based water-safety program" if club["title"].startswith("Elizabeth ") else "Junior / Nippers activities"
        offers.append(label)
    if club.get("youth"):
        offers.append("Youth participation")
    if club.get("patrol"):
        offers.append("Lifesaving and patrolling")
    if club.get("sports"):
        offers.append("Surf sports and competition: " + ", ".join(club["sports"]))
    if club.get("sports_support"):
        offers.append("Surf-sports support roles including coaching, officiating or administration")
    if club.get("adaptive"):
        offers.append(club["adaptive"])
    if club.get("multicultural"):
        offers.append(club["multicultural"])
    if club.get("first_nations"):
        offers.append(club["first_nations"])
    offers.extend(club.get("other_programs", []))

    for item in offers:
        lines.append(f"- {item}")
    if not offers:
        lines.append("- Contact the club for current programs and activities.")

    lines += ["", "## Training, Nippers and member activity", ""]
    if club.get("nippers"):
        lines.append(f"- **Junior activities:** {club['nippers']}")
    if club.get("youth"):
        lines.append(f"- **Youth:** {club['youth']}")
    if club.get("patrol"):
        lines.append(f"- **Lifesaving and patrolling:** {club['patrol']}")
    if club.get("sports"):
        lines.append(f"- **Surf sports:** {', '.join(club['sports'])}.")
    if club.get("sports_support"):
        lines.append("- **Surf-sports support:** Coaching, officiating and administration opportunities are listed by the club.")
    if not any([club.get("nippers"), club.get("youth"), club.get("patrol"), club.get("sports")]):
        lines.append("- Contact the club for current training and activity times.")

    lines += ["", "## Membership fees and joining notes", ""]
    if club.get("fees"):
        for fee in club["fees"]:
            lines.append(f"- **{fee['name']} — {fee['price']}:** {fee['description']}")
    else:
        lines.append(f"- {club['fee_note']}")
    if club.get("fees"):
        lines.append(f"- **Fee note:** {club['fee_note']}")

    lines += ["", "## Facilities and accessibility", ""]
    if club.get("facilities_text"):
        for facility in club["facilities_text"]:
            lines.append(f"- {facility}")
    else:
        lines.append("- No facilities were confirmed in the supplied 2026/27 club information. Contact the club if a particular facility is important to you.")

    lines += ["", "## Contact and visiting", ""]
    if club.get("contact_name"):
        lines.append(f"- **New-member contact:** {club['contact_name']}")
    if club.get("contact_email"):
        lines.append(f"- **Email:** [{club['contact_email']}](mailto:{club['contact_email']})")
    if club.get("secondary_email"):
        lines.append(f"- **Additional email:** [{club['secondary_email']}](mailto:{club['secondary_email']})")
    if club.get("phone"):
        lines.append(f"- **Phone:** {club['phone']}")
    if not club.get("contact_email"):
        lines.append(f"- **Contact:** Use the club website: [{club['website']}]({club['website']})")
    lines.append(f"- **When to visit:** {club['visit']}")

    lines += ["", "## Culture and club fit", ""]
    for item in club["best_for"]:
        lines.append(f"- {item}")

    lines += ["", "## Profile sources and review notes", ""]
    lines.append(f"- 2026/27 club information supplied to Surf Life Saving SA: **{club['source_document']}**")
    lines.append(f"- Club website: [{club['website']}]({club['website']})")
    if club.get("address") or existing_address:
        lines.append(f"- Club address used for this profile: {club.get('address') or existing_address}")
    lines.append("- Details such as fees, program times and office holders can change. Prospective members should confirm time-sensitive information with the club.")

    return "\n".join(lines)


def update_meta(meta: dict, club: dict) -> dict:
    out = copy.deepcopy(meta)

    # Core page identity.
    out["layout"] = "club"
    out["title"] = club["title"]
    out["slug"] = club["slug"]
    out["permalink"] = f"/clubs/{club['slug']}/"
    out["summary"] = club["summary"]

    # Source-supplied factual fields.
    if club.get("address"):
        out["address"] = club["address"]
    out["website"] = club["website"]
    out["member_size"] = SIZE_LABELS[club["size"]]
    out["membership_fee_note"] = membership_fee_note(club)
    out["membership_fee_source"] = club["website"]
    out["source_checked"] = "2026-08-24"

    # Structured fields used by the current/future finder.
    out["age_groups"] = derive_age_groups(club)
    out["interests"] = derive_interests(club)
    if not out.get("facilities"):
        out["facilities"] = infer_facility_tags(club)
    out["verified_programs"] = verified_programs(club)
    out["best_for"] = club["best_for"]

    # Preserve existing commitment/badge settings because they are site-curated
    # and are not supplied by the club information return.
    if not out.get("commitment"):
        out["commitment"] = {"id": "flexible", "label": "Flexible"}

    # Human-readable feature fields.
    out["adaptive_program"] = club.get("adaptive") or "No specific program listed"
    out["multicultural_program"] = club.get("multicultural") or "No specific program listed"
    out["first_nations_program"] = club.get("first_nations") or "No specific program listed"

    facilities_lower = " ".join(club.get("facilities_text", [])).lower()
    if "gym" in facilities_lower:
        gym_detail = next((x for x in club["facilities_text"] if "gym" in x.lower()), "Yes")
        out["gym_facilities"] = gym_detail
    else:
        out["gym_facilities"] = "No gym listed"

    out["family_friendly"] = "Yes" if club.get("nippers") or any("family" in f["name"].lower() for f in club.get("fees", [])) else "Ask club"

    # Additional structured data. Jekyll will safely ignore these if the current
    # layout does not yet render them.
    out["new_member_contact"] = {
        "name": club.get("contact_name"),
        "email": club.get("contact_email"),
        "secondary_email": club.get("secondary_email"),
        "phone": club.get("phone"),
        "visit": club.get("visit"),
    }
    out["activity_details"] = make_activity_details(club)
    out["facility_details"] = club.get("facilities_text", [])
    out["membership_options"] = club.get("fees", [])
    out["membership_pricing_status"] = club["fee_note"]

    return out


def write_report(report_path: Path, results: list[dict], apply: bool) -> None:
    lines = [
        "# Club Page Update Report",
        "",
        f"Generated: {datetime.now().astimezone().strftime('%Y-%m-%d %H:%M %Z')}",
        f"Mode: {'APPLIED' if apply else 'DRY RUN'}",
        "",
        "## Global changes made by the updater",
        "",
        "- Club slugs and permalinks are shortened to `-slsc` (or `-lsc` for Elizabeth and Murray Bridge).",
        "- Physical Markdown filenames are deliberately unchanged by this updater.",
        "- Existing image paths, suburb, region, coordinates, commitment settings, badge settings and other unknown front-matter fields are preserved.",
        "- Club-supplied 2026/27 contact, program, activity, facility and membership information is used to replace the existing profile prose.",
        "- Editorial prose, summaries and `best_for` statements are generated from the supplied facts and are identified below as built/standardised content.",
        "",
        "## Per-club review",
        "",
    ]

    for result in results:
        club = result["club"]
        lines += [
            f"### {club['title']}",
            "",
            f"- **File:** {result.get('path', 'NOT FOUND')}",
            f"- **Status:** {result['status']}",
            f"- **Source:** {club['source_document']}",
        ]
        if club.get("clarifications"):
            lines.append("- **Needs clarification / source issue:**")
            for item in club["clarifications"]:
                lines.append(f"  - {item}")
        else:
            lines.append("- **Needs clarification / source issue:** None identified.")
        if club.get("built"):
            lines.append("- **Added, cleaned or inferred by the updater:**")
            for item in club["built"]:
                lines.append(f"  - {item}")
        else:
            lines.append("- **Added, cleaned or inferred by the updater:** Standardised wording only.")
        lines.append("")

    lines += [
        "## Important items to resolve before treating all profiles as final",
        "",
        "- Beachport: confirm the post-AGM Club Registrar.",
        "- Chiton Rocks: confirm the correct current membership contact name.",
        "- Elizabeth: no new-member email/contact was supplied; pricing is intentionally not public.",
        "- Glenelg: confirm final 2026/27 pricing, particularly the corrupted 13–15 fee.",
        "- Goolwa: pricing is marked under review.",
        "- Murray Bridge: confirm Nipper session times.",
        "- Normanville: confirm post-AGM 2026/27 fees.",
        "- Port Elliot: no personal new-member contact name was supplied.",
        "- Port Noarlunga: supplied fees are 2025/26 and need 2026/27 confirmation.",
        "- Robe: supplied document has no street address or named new-member contact.",
        "- Seacliff: confirm the current post-AGM office holder and exact Nippers finish time.",
        "- Semaphore: source is marked UNOFFICIAL and its Multicultural/First Nations rows are internally inconsistent.",
        "- Somerton: confirm whether the 7–13 fee is $325; this conflicts with the source’s stated $230–$315 summary range.",
        "",
    ]

    report_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Write changes. Without this flag the script performs a dry run.")
    parser.add_argument("--club-dir", default="_clubs", help="Path to the Jekyll club collection (default: _clubs)")
    parser.add_argument("--report", default="club-update-report.md", help="Report output path")
    args = parser.parse_args()

    root = Path.cwd()
    club_dir = root / args.club_dir
    if not club_dir.is_dir():
        print(f"ERROR: {club_dir} does not exist. Run this from the repository root.", file=sys.stderr)
        return 2

    backup_root = None
    if args.apply:
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup_root = root / "_club_update_backups" / stamp
        backup_root.mkdir(parents=True, exist_ok=True)

    results = []
    changed = 0

    for club in CLUBS:
        path = find_club_file(club_dir, club)
        if path is None:
            print(f"[NOT FOUND] {club['title']}")
            results.append({"club": club, "status": "NOT FOUND", "path": None})
            continue

        try:
            original = path.read_text(encoding="utf-8")
            meta, _old_body = split_page(original)
        except Exception as exc:
            print(f"[ERROR] {path}: {exc}")
            results.append({"club": club, "status": f"ERROR: {exc}", "path": str(path)})
            continue

        new_meta = update_meta(meta, club)
        new_body = render_body(club, existing_address=meta.get("address"))
        updated = dump_page(new_meta, new_body)

        if updated == original:
            status = "NO CHANGE"
        elif args.apply:
            assert backup_root is not None
            backup_path = backup_root / path.name
            shutil.copy2(path, backup_path)
            path.write_text(updated, encoding="utf-8")
            status = "UPDATED"
            changed += 1
        else:
            status = "WOULD UPDATE"
            changed += 1

        print(f"[{status}] {path}")
        results.append({"club": club, "status": status, "path": str(path)})

    report_path = root / args.report
    write_report(report_path, results, args.apply)

    print()
    print(f"{'Would update' if not args.apply else 'Updated'}: {changed} club page(s)")
    print(f"Report: {report_path}")
    if args.apply and backup_root:
        print(f"Backups: {backup_root}")
    if not args.apply:
        print()
        print("Dry run only. Review the report, then run:")
        print("  py scripts/update_club_pages.py --apply")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
