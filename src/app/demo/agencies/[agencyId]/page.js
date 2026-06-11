'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AgencyDashboardPage from '@/components/community/AgencyDashboardPage';
import { createClient } from '@/lib/supabase/client';

/* ------------------------------------------------------------------ */
/*  Full rich demo data — KES-denominated, Kenya context               */
/* ------------------------------------------------------------------ */

const DEMO_DATA = {

  /* ═══════════════════════════ iTek ═══════════════════════════ */
  itek: {
    name: 'iTek',
    monthly: [
      { m:'Jan', goal:1200000, actual:1085000 },
      { m:'Feb', goal:1350000, actual:1410000 },
      { m:'Mar', goal:1500000, actual:1620000 },
      { m:'Apr', goal:1650000, actual:1490000 },
      { m:'May', goal:1800000, actual:1875000 },
      { m:'Jun', goal:2000000, actual:1740000 },
      { m:'Jul', goal:2100000, actual:null },
      { m:'Aug', goal:2250000, actual:null },
      { m:'Sep', goal:2400000, actual:null },
      { m:'Oct', goal:2550000, actual:null },
      { m:'Nov', goal:2700000, actual:null },
      { m:'Dec', goal:3000000, actual:null },
    ],
    projects: [
      { name:'Client Portal v2',        owner:'Alex K.',  goal:'Launch for 5 enterprise clients',      current:3,     target:5,    unit:'clients',    status:'On track',  due:'Sep 2026' },
      { name:'Backend API Refactor',    owner:'Sam T.',   goal:'Migrate 14 legacy endpoints',           current:9,     target:14,   unit:'endpoints',  status:'On track',  due:'Aug 2026' },
      { name:'Mobile App MVP',          owner:'Joy M.',   goal:'Ship to App Store & Play Store',        current:2,     target:2,    unit:'stores',     status:'Completed', due:'May 2026' },
      { name:'DevOps Automation',       owner:'Kevin O.', goal:'Reduce deploy time to under 8 minutes', current:11,    target:8,    unit:'minutes',    status:'At risk',   due:'Jul 2026' },
      { name:'SaaS Licensing Portal',   owner:'Mercy W.', goal:'Onboard 20 SaaS subscribers',           current:7,     target:20,   unit:'subscribers',status:'Behind',    due:'Nov 2026' },
    ],
    losses: [
      { source:'Client churn',         amount:320000, note:'2 retainer clients did not renew in Q1' },
      { source:'Scope overruns',       amount:210000, note:'Portal project scope crept by 40%' },
      { source:'Bad debt write-off',   amount:140000, note:'Invoice #3120 unrecoverable' },
      { source:'Bench time',           amount:95000,  note:'2 engineers idle between projects' },
      { source:'Discounts & waivers',  amount:72000,  note:'NGO pricing concessions' },
      { source:'FX & transfer fees',   amount:38000,  note:'USD-KES conversion on international project' },
    ],
    expenses: [
      { cat:'Salaries & stipends',  amount:780000 },
      { cat:'Cloud infrastructure', amount:210000 },
      { cat:'Rent & utilities',     amount:145000 },
      { cat:'Software licences',    amount:98000  },
      { cat:'Travel & logistics',   amount:76000  },
      { cat:'Marketing & outreach', amount:54000  },
      { cat:'Admin & misc',         amount:37000  },
    ],
    expTrend: [
      { m:'Jan', amount:1250000 },{ m:'Feb', amount:1290000 },{ m:'Mar', amount:1350000 },
      { m:'Apr', amount:1320000 },{ m:'May', amount:1380000 },{ m:'Jun', amount:1400000 },
    ],
    models: [
      { name:'Service retainers',   desc:'Monthly web & software maintenance contracts',    tracked:true,  mtd:620000, share:35, trend:8  },
      { name:'Project fees',        desc:'Fixed-scope build & design engagements',          tracked:true,  mtd:500000, share:28, trend:4  },
      { name:'SaaS subscriptions',  desc:'AgriData & Soko platform subscriptions',          tracked:true,  mtd:290000, share:16, trend:22 },
      { name:'Training & workshops',desc:'Paid cohorts and corporate tech sessions',         tracked:true,  mtd:200000, share:11, trend:14 },
      { name:'Licensing royalties', desc:'White-label SDK licensing to partner agencies',    tracked:false, mtd:120000, share:7,  trend:5  },
      { name:'Advisory',            desc:'CTO-as-a-service and architecture reviews',        tracked:false, mtd:50000,  share:3,  trend:2  },
    ],
    rateCard: [
      { service:'Web Development',        unit:'per project',  rate:350000 },
      { service:'Software Development',   unit:'per day',      rate:22000  },
      { service:'UI / UX Design',         unit:'per day',      rate:17000  },
      { service:'Monthly Maintenance',    unit:'per month',    rate:45000  },
      { service:'Training Workshop',      unit:'per cohort',   rate:120000 },
      { service:'Tech Advisory',          unit:'per hour',     rate:8000   },
    ],
    receivables: [
      { client:'Rift Valley Sacco',     service:'Software development',    amount:810000, status:'Pending', due:'30 Jun 2026' },
      { client:'Green County Gov.',     service:'Maintenance (annual)',     amount:540000, status:'Pending', due:'01 Aug 2026' },
      { client:'Karen Wellness Centre', service:'UI / UX design',          amount:290000, status:'Pending', due:'15 Jul 2026' },
      { client:'Nakuru Fresh Produce',  service:'Web + maintenance',        amount:210000, status:'Overdue', due:'12 May 2026' },
      { client:'BrightStep Academy',    service:'Training workshop',        amount:120000, status:'Paid',    due:'02 Jun 2026' },
      { client:'Soko Vendors Assoc.',   service:'Tech advisory',            amount:96000,  status:'Overdue', due:'28 Apr 2026' },
    ],
    growth: [
      { p:"Q3 '25", cons:3.6, base:3.9, aggr:4.3 },
      { p:"Q4 '25", cons:4.0, base:4.5, aggr:5.2 },
      { p:"Q1 '26", cons:4.4, base:5.2, aggr:6.3 },
      { p:"Q2 '26", cons:4.9, base:6.1, aggr:7.6 },
      { p:"Q3 '26", cons:5.3, base:7.0, aggr:9.1 },
      { p:"Q4 '26", cons:5.8, base:8.1, aggr:10.9 },
      { p:"Q1 '27", cons:6.3, base:9.4, aggr:13.1 },
      { p:"Q2 '27", cons:6.9, base:10.8,aggr:15.7 },
    ],
    levers: [
      { k:'Base-case ARR (proj.)',  v:'KES 43.2M', note:'end of FY27' },
      { k:'Projected MoM growth',  v:'+9.4%',     note:'base scenario' },
      { k:'Net revenue retention', v:'112%',       note:'expansion > churn' },
      { k:'CAC payback',           v:'3.1 mo',    note:'service-led motion' },
    ],
    innovationBoard: {
      Idea:      [{ t:'AI code-review bot for client repos', o:'Sam T.',   impact:'High'   }, { t:'Offline-first PWA framework', o:'Kevin O.', impact:'Medium' }],
      Exploring: [{ t:'WhatsApp API management platform',   o:'Alex K.',  impact:'High'   }, { t:'Automated DevOps pipeline SaaS', o:'Joy M.', impact:'Medium' }],
      Piloting:  [{ t:'SaaS billing self-service portal',   o:'Mercy W.', impact:'High'   }],
      Scaling:   [{ t:'Client analytics dashboard (v2)',    o:'Alex K.',  impact:'High'   }],
      Parked:    [{ t:'Crypto micropayments integration',   o:'Sam T.',   impact:'Low'    }],
    },
  },

  /* ═══════════════════════════ i3x Africa ═══════════════════════════ */
  i3x: {
    name: 'i3x Africa',
    monthly: [
      { m:'Jan', goal:800000,  actual:680000  },
      { m:'Feb', goal:900000,  actual:850000  },
      { m:'Mar', goal:1000000, actual:1040000 },
      { m:'Apr', goal:1100000, actual:960000  },
      { m:'May', goal:1200000, actual:1180000 },
      { m:'Jun', goal:1350000, actual:1100000 },
      { m:'Jul', goal:1450000, actual:null    },
      { m:'Aug', goal:1600000, actual:null    },
      { m:'Sep', goal:1750000, actual:null    },
      { m:'Oct', goal:1900000, actual:null    },
      { m:'Nov', goal:2050000, actual:null    },
      { m:'Dec', goal:2200000, actual:null    },
    ],
    projects: [
      { name:'Nairobi Innovation Hub',   owner:'Amara O.',  goal:'Launch coworking hub, 50 member seats', current:34, target:50, unit:'seats',    status:'On track',  due:'Sep 2026' },
      { name:'Kampala Expansion',        owner:'Lena M.',   goal:'Establish Uganda operations',           current:2,  target:5,  unit:'milestones',status:'At risk',   due:'Oct 2026' },
      { name:'Dar es Salaam Office',     owner:'Amara O.',  goal:'Sign lease & fit out by Q4',            current:1,  target:3,  unit:'milestones',status:'Behind',    due:'Nov 2026' },
      { name:'Africa Impact Report 2026',owner:'Kwame B.',  goal:'Publish 5 country impact reports',      current:5,  target:5,  unit:'reports',   status:'Completed', due:'Jun 2026' },
      { name:'Partner Network',          owner:'Lena M.',   goal:'Onboard 20 regional partners',          current:14, target:20, unit:'partners',  status:'On track',  due:'Dec 2026' },
    ],
    losses: [
      { source:'Grant underspend',   amount:180000, note:'Q1 USAID grant milestone delayed' },
      { source:'Currency risk',      amount:140000, note:'UGX/KES depreciation on Kampala ops' },
      { source:'Inactive memberships',amount:95000, note:'12 members churned in Q2' },
      { source:'Event no-shows',     amount:60000,  note:'Paid delegates who did not attend summit' },
    ],
    expenses: [
      { cat:'Staff & contractors',  amount:560000 },
      { cat:'Hub operations',       amount:240000 },
      { cat:'Travel across region', amount:185000 },
      { cat:'Events & summits',     amount:130000 },
      { cat:'Comms & marketing',    amount:80000  },
      { cat:'Admin & misc',         amount:45000  },
    ],
    expTrend: [
      { m:'Jan', amount:1100000 },{ m:'Feb', amount:1140000 },{ m:'Mar', amount:1200000 },
      { m:'Apr', amount:1180000 },{ m:'May', amount:1250000 },{ m:'Jun', amount:1240000 },
    ],
    models: [
      { name:'Membership fees',     desc:'Annual & monthly hub membership tiers',          tracked:true,  mtd:380000, share:34, trend:6  },
      { name:'Grant funding',       desc:'USAID, DFID and bilateral donor grants',         tracked:true,  mtd:290000, share:26, trend:-3 },
      { name:'Event revenue',       desc:'Summit tickets, sponsorships, exhibition fees',  tracked:true,  mtd:210000, share:19, trend:12 },
      { name:'Partnership commissions',desc:'Cross-border referral and reseller revenue',  tracked:true,  mtd:130000, share:12, trend:4  },
      { name:'Content & media',     desc:'Publication licensing and media partnerships',   tracked:false, mtd:80000,  share:7,  trend:18 },
      { name:'Consultancy',         desc:'Market entry advisory for international firms',  tracked:false, mtd:22000,  share:2,  trend:0  },
    ],
    rateCard: [
      { service:'Hub Desk (hot)',     unit:'per month',   rate:18000  },
      { service:'Hub Desk (dedicated)',unit:'per month',  rate:35000  },
      { service:'Private Office',     unit:'per month',   rate:90000  },
      { service:'Event Space Hire',   unit:'per day',     rate:55000  },
      { service:'Market Entry Advisory',unit:'per engagement',rate:280000},
      { service:'Partnership Facilitation',unit:'per deal',rate:120000},
    ],
    receivables: [
      { client:'Safaricom Foundation',   service:'Partnership facilitation', amount:360000, status:'Pending', due:'15 Jul 2026' },
      { client:'Equity Afia',            service:'Market entry advisory',    amount:280000, status:'Pending', due:'01 Aug 2026' },
      { client:'East Africa Breweries',  service:'Event space hire (x4)',    amount:220000, status:'Paid',    due:'30 May 2026' },
      { client:'Cellulant Corp',         service:'Hub membership (annual)',  amount:140000, status:'Overdue', due:'31 Mar 2026' },
    ],
    growth: [
      { p:"Q3 '25", cons:2.8, base:3.1, aggr:3.5 },
      { p:"Q4 '25", cons:3.1, base:3.6, aggr:4.2 },
      { p:"Q1 '26", cons:3.4, base:4.2, aggr:5.1 },
      { p:"Q2 '26", cons:3.7, base:4.9, aggr:6.2 },
      { p:"Q3 '26", cons:4.1, base:5.7, aggr:7.5 },
      { p:"Q4 '26", cons:4.5, base:6.6, aggr:9.1 },
      { p:"Q1 '27", cons:4.9, base:7.7, aggr:11.0},
      { p:"Q2 '27", cons:5.4, base:9.0, aggr:13.2},
    ],
    levers: [
      { k:'Base-case ARR (proj.)',  v:'KES 36.0M', note:'end of FY27' },
      { k:'Projected MoM growth',  v:'+8.7%',     note:'base scenario' },
      { k:'Net revenue retention', v:'105%',       note:'expansion > churn' },
      { k:'Runway',                v:'16 mo',      note:'at current burn rate' },
    ],
    innovationBoard: {
      Idea:      [{ t:'USSD-based membership portal for low-bandwidth users', o:'Amara O.', impact:'High' }, { t:'Cross-border talent marketplace', o:'Kwame B.', impact:'Medium' }],
      Exploring: [{ t:'Regional franchise model for hub replication', o:'Amara O.', impact:'High' }],
      Piloting:  [{ t:'Pan-African podcast series — "Builders of the South"', o:'Lena M.', impact:'Medium' }],
      Scaling:   [{ t:'Virtual hub membership tier', o:'Kwame B.', impact:'High' }],
      Parked:    [{ t:'Crypto-based cross-border payments', o:'Amara O.', impact:'Low' }],
    },
  },

  /* ═══════════════════════════ i3+ ═══════════════════════════ */
  'i3plus': {
    name: 'i3+',
    monthly: [
      { m:'Jan', goal:1800000, actual:1720000 },
      { m:'Feb', goal:1950000, actual:2010000 },
      { m:'Mar', goal:2100000, actual:2260000 },
      { m:'Apr', goal:2300000, actual:2150000 },
      { m:'May', goal:2500000, actual:2580000 },
      { m:'Jun', goal:2700000, actual:2480000 },
      { m:'Jul', goal:2900000, actual:null    },
      { m:'Aug', goal:3100000, actual:null    },
      { m:'Sep', goal:3300000, actual:null    },
      { m:'Oct', goal:3500000, actual:null    },
      { m:'Nov', goal:3700000, actual:null    },
      { m:'Dec', goal:4000000, actual:null    },
    ],
    projects: [
      { name:'Platinum Tier Launch',     owner:'Claire N.', goal:'Onboard 40 Platinum members',    current:28, target:40, unit:'members',    status:'On track',  due:'Sep 2026' },
      { name:'VIP Concierge Programme',  owner:'Claire N.', goal:'Deploy 3 dedicated concierge staff',current:3,target:3, unit:'staff',       status:'Completed', due:'Apr 2026' },
      { name:'Luxury Brand Partnerships',owner:'Nia S.',    goal:'Sign 8 luxury brand deals',       current:5,  target:8,  unit:'partnerships',status:'On track',  due:'Oct 2026' },
      { name:'Member Events Calendar',   owner:'Nia S.',    goal:'Host 12 exclusive events in FY26', current:6, target:12, unit:'events',      status:'On track',  due:'Dec 2026' },
    ],
    losses: [
      { source:'Membership downgrades', amount:220000, note:'8 members dropped from Platinum to Gold' },
      { source:'Event cancellations',   amount:180000, note:'2 luxury events cancelled due to venue issues' },
      { source:'Dormant accounts',      amount:110000, note:'Inactive members consuming concierge hours' },
    ],
    expenses: [
      { cat:'Concierge & staff',       amount:920000 },
      { cat:'Events & experiences',    amount:380000 },
      { cat:'Luxury partnerships',     amount:210000 },
      { cat:'Facilities',              amount:160000 },
      { cat:'Comms & branding',        amount:90000  },
      { cat:'Admin',                   amount:40000  },
    ],
    expTrend: [
      { m:'Jan', amount:1680000 },{ m:'Feb', amount:1720000 },{ m:'Mar', amount:1800000 },
      { m:'Apr', amount:1790000 },{ m:'May', amount:1810000 },{ m:'Jun', amount:1800000 },
    ],
    models: [
      { name:'Platinum membership',    desc:'Annual fee — top-tier member benefits',          tracked:true,  mtd:1100000, share:42, trend:9  },
      { name:'Gold membership',        desc:'Mid-tier membership package',                    tracked:true,  mtd:780000,  share:30, trend:3  },
      { name:'Event ticket sales',     desc:'Exclusive ticketed experiences',                 tracked:true,  mtd:350000,  share:13, trend:15 },
      { name:'Partner commissions',    desc:'Revenue share from luxury brand referrals',      tracked:true,  mtd:210000,  share:8,  trend:6  },
      { name:'Concierge add-ons',      desc:'Bespoke services beyond membership bundle',      tracked:false, mtd:160000,  share:6,  trend:20 },
      { name:'Digital content',        desc:'Premium member-only content subscriptions',      tracked:false, mtd:20000,   share:1,  trend:0  },
    ],
    rateCard: [
      { service:'Platinum Membership', unit:'per year',   rate:480000 },
      { service:'Gold Membership',     unit:'per year',   rate:240000 },
      { service:'Event Ticket (VIP)',  unit:'per event',  rate:45000  },
      { service:'Concierge Day Rate',  unit:'per day',    rate:30000  },
      { service:'Brand Partnership',   unit:'per quarter',rate:180000 },
    ],
    receivables: [
      { client:'Nairobi Serena Hotel',    service:'Brand partnership',      amount:360000, status:'Pending', due:'30 Jul 2026' },
      { client:'Heritage Hotels Group',   service:'Brand partnership',      amount:360000, status:'Pending', due:'15 Aug 2026' },
      { client:'Mr. A. Muthoni',          service:'Platinum membership',    amount:480000, status:'Overdue', due:'01 Apr 2026' },
      { client:'KCB Group Ltd',           service:'Corporate membership ×5',amount:1200000,status:'Pending', due:'01 Sep 2026' },
    ],
    growth: [
      { p:"Q3 '25", cons:5.4, base:5.9, aggr:6.5 },
      { p:"Q4 '25", cons:6.0, base:6.8, aggr:7.8 },
      { p:"Q1 '26", cons:6.7, base:7.9, aggr:9.4 },
      { p:"Q2 '26", cons:7.4, base:9.2, aggr:11.3},
      { p:"Q3 '26", cons:8.2, base:10.7,aggr:13.6},
      { p:"Q4 '26", cons:9.1, base:12.4,aggr:16.3},
      { p:"Q1 '27", cons:10.1,base:14.4,aggr:19.6},
      { p:"Q2 '27", cons:11.2,base:16.7,aggr:23.5},
    ],
    levers: [
      { k:'Base-case ARR (proj.)',  v:'KES 66.8M', note:'end of FY27' },
      { k:'Avg. revenue / member', v:'KES 320K',  note:'+14% YoY growth' },
      { k:'Net revenue retention', v:'118%',       note:'upsell > churn' },
      { k:'Churn rate',            v:'4.2%',       note:'well below 8% target' },
    ],
    innovationBoard: {
      Idea:      [{ t:'AI-powered member lifestyle assistant', o:'Claire N.', impact:'High' }, { t:'Health & wellness premium bundle', o:'Nia S.', impact:'Medium' }],
      Exploring: [{ t:'Diaspora membership tier (international)', o:'Claire N.', impact:'High' }],
      Piloting:  [{ t:'Member gifting & rewards marketplace', o:'Nia S.', impact:'High' }],
      Scaling:   [{ t:'Digital member card & NFC access', o:'Claire N.', impact:'High' }],
      Parked:    [{ t:'NFT-based membership certificates', o:'Nia S.', impact:'Low' }],
    },
  },

  /* ═══════════════════════════ Assets ═══════════════════════════ */
  assets: {
    name: 'Assets',
    monthly: [
      { m:'Jan', goal:480000, actual:420000  },
      { m:'Feb', goal:520000, actual:505000  },
      { m:'Mar', goal:560000, actual:590000  },
      { m:'Apr', goal:600000, actual:555000  },
      { m:'May', goal:650000, actual:670000  },
      { m:'Jun', goal:700000, actual:640000  },
      { m:'Jul', goal:750000, actual:null    },
      { m:'Aug', goal:800000, actual:null    },
      { m:'Sep', goal:850000, actual:null    },
      { m:'Oct', goal:900000, actual:null    },
      { m:'Nov', goal:950000, actual:null    },
      { m:'Dec', goal:1000000,actual:null    },
    ],
    projects: [
      { name:'Digital Asset Registry',  owner:'David M.', goal:'Digitise 500 asset records',         current:342, target:500, unit:'records',    status:'On track',  due:'Sep 2026' },
      { name:'Asset Utilisation Scoring',owner:'David M.',goal:'Score all 8 asset categories',        current:5,   target:8,   unit:'categories', status:'On track',  due:'Oct 2026' },
      { name:'Fleet GPS Tracking',      owner:'Nancy G.', goal:'Install GPS on 12 vehicles',          current:12,  target:12,  unit:'vehicles',   status:'Completed', due:'Mar 2026' },
      { name:'Property Lease Renewal',  owner:'Nancy G.', goal:'Renegotiate 6 property leases',       current:2,   target:6,   unit:'leases',     status:'At risk',   due:'Nov 2026' },
    ],
    losses: [
      { source:'Asset depreciation',    amount:140000, note:'Unplanned obsolescence on IT equipment' },
      { source:'Under-utilisation',     amount:95000,  note:'2 vehicles idle > 30 days in Q2' },
      { source:'Damage & repair',       amount:62000,  note:'Warehouse shelving damage from fire drill' },
    ],
    expenses: [
      { cat:'Maintenance & repairs',   amount:190000 },
      { cat:'Insurance premiums',      amount:150000 },
      { cat:'Staff & operations',      amount:140000 },
      { cat:'Depreciation provision',  amount:110000 },
      { cat:'Storage & utilities',     amount:75000  },
      { cat:'Admin & misc',            amount:35000  },
    ],
    expTrend: [
      { m:'Jan', amount:650000 },{ m:'Feb', amount:670000 },{ m:'Mar', amount:695000 },
      { m:'Apr', amount:680000 },{ m:'May', amount:710000 },{ m:'Jun', amount:700000 },
    ],
    models: [
      { name:'Equipment leasing',    desc:'Monthly lease income from leased hardware',    tracked:true,  mtd:260000, share:38, trend:5  },
      { name:'Vehicle rental',       desc:'Fleet hire to group companies & external',      tracked:true,  mtd:180000, share:26, trend:2  },
      { name:'Property sub-letting', desc:'Subletting of excess office space',             tracked:true,  mtd:130000, share:19, trend:0  },
      { name:'Depreciation recovery',desc:'Recharges to business units for asset use',    tracked:true,  mtd:80000,  share:12, trend:-1 },
      { name:'Asset disposal',       desc:'Proceeds from sold / written-off assets',       tracked:false, mtd:34000,  share:5,  trend:0  },
    ],
    rateCard: [
      { service:'Vehicle daily hire',  unit:'per day',   rate:8500  },
      { service:'Equipment lease',     unit:'per month',  rate:25000 },
      { service:'Office sub-let',      unit:'per month',  rate:65000 },
      { service:'Storage unit',        unit:'per month',  rate:12000 },
    ],
    receivables: [
      { client:'i3Studios',            service:'Equipment lease',    amount:75000,  status:'Pending', due:'30 Jun 2026' },
      { client:'iTek',                 service:'Vehicle hire (x6)',  amount:51000,  status:'Paid',    due:'15 Jun 2026' },
      { client:'ExternalCo Ltd',       service:'Office sub-let',     amount:130000, status:'Overdue', due:'01 May 2026' },
    ],
    growth: [
      { p:"Q3 '25", cons:1.5, base:1.7, aggr:1.9 },
      { p:"Q4 '25", cons:1.7, base:2.0, aggr:2.3 },
      { p:"Q1 '26", cons:1.9, base:2.3, aggr:2.8 },
      { p:"Q2 '26", cons:2.1, base:2.7, aggr:3.4 },
      { p:"Q3 '26", cons:2.3, base:3.1, aggr:4.1 },
      { p:"Q4 '26", cons:2.5, base:3.6, aggr:5.0 },
      { p:"Q1 '27", cons:2.8, base:4.2, aggr:6.0 },
      { p:"Q2 '27", cons:3.1, base:4.9, aggr:7.2 },
    ],
    levers: [
      { k:'Base-case ARR (proj.)',  v:'KES 19.6M', note:'end of FY27' },
      { k:'Asset utilisation rate', v:'74%',       note:'+6pp YoY' },
      { k:'Avg. lease duration',    v:'11 mo',     note:'improving stickiness' },
      { k:'Depreciation coverage',  v:'82%',       note:'via recharge model' },
    ],
    innovationBoard: {
      Idea:      [{ t:'IoT asset health monitoring dashboard', o:'David M.', impact:'High' }, { t:'Peer-to-peer equipment lending marketplace', o:'Nancy G.', impact:'Medium' }],
      Exploring: [{ t:'Carbon footprint tracking per asset', o:'David M.', impact:'Medium' }],
      Piloting:  [{ t:'QR-based asset check-in/check-out system', o:'Nancy G.', impact:'High' }],
      Scaling:   [],
      Parked:    [{ t:'Tokenised asset ownership fractions', o:'David M.', impact:'Low' }],
    },
  },

  /* ═══════════════════════════ impactFund ═══════════════════════════ */
  impactfund: {
    name: 'impactFund',
    monthly: [
      { m:'Jan', goal:2000000, actual:1650000 },
      { m:'Feb', goal:2200000, actual:2100000 },
      { m:'Mar', goal:2500000, actual:2750000 },
      { m:'Apr', goal:2800000, actual:2430000 },
      { m:'May', goal:3200000, actual:3100000 },
      { m:'Jun', goal:3500000, actual:2980000 },
      { m:'Jul', goal:3800000, actual:null    },
      { m:'Aug', goal:4200000, actual:null    },
      { m:'Sep', goal:4600000, actual:null    },
      { m:'Oct', goal:5000000, actual:null    },
      { m:'Nov', goal:5500000, actual:null    },
      { m:'Dec', goal:6000000, actual:null    },
    ],
    projects: [
      { name:'Q3 Fundraising Campaign',   owner:'Fatima H.', goal:'Raise KES 12M in Q3',              current:7200000, target:12000000,unit:'KES',       status:'On track',  due:'Sep 2026' },
      { name:'Angel Investor Network',    owner:'Fatima H.', goal:'Onboard 15 angel investors',       current:9,       target:15,      unit:'investors', status:'On track',  due:'Oct 2026' },
      { name:'Micro-grant Programme',     owner:'Wanjiku K.',goal:'Disburse 50 micro-grants ≤ KES 50K',current:32,     target:50,      unit:'grants',    status:'On track',  due:'Dec 2026' },
      { name:'Impact Report 2026',        owner:'Wanjiku K.',goal:'Publish and distribute 1,000 copies',current:1000,  target:1000,    unit:'copies',    status:'Completed', due:'Jun 2026' },
      { name:'Crowdfunding Platform',     owner:'Fatima H.', goal:'Launch public campaign with 200 donors',current:78, target:200,     unit:'donors',    status:'At risk',   due:'Aug 2026' },
    ],
    losses: [
      { source:'Donor pledge fall-through',amount:480000, note:'3 corporate pledges not honoured in Q1' },
      { source:'Grant underspend',         amount:320000, note:'DANIDA milestone delayed to Q3' },
      { source:'Campaign costs overrun',   amount:210000, note:'Digital marketing spend 40% over budget' },
      { source:'FX losses',               amount:150000, note:'USD-KES gap on international grant receipt' },
      { source:'Bad debt — grantee',      amount:90000,  note:'Grantee insolvent, KES 90K unrecoverable' },
    ],
    expenses: [
      { cat:'Grant disbursements',     amount:1800000 },
      { cat:'Staff & operations',      amount:680000  },
      { cat:'Fundraising & marketing', amount:320000  },
      { cat:'Due diligence & legal',   amount:180000  },
      { cat:'Tech & reporting tools',  amount:95000   },
      { cat:'Admin & misc',            amount:55000   },
    ],
    expTrend: [
      { m:'Jan', amount:2900000 },{ m:'Feb', amount:3050000 },{ m:'Mar', amount:3200000 },
      { m:'Apr', amount:3100000 },{ m:'May', amount:3300000 },{ m:'Jun', amount:3130000 },
    ],
    models: [
      { name:'Donor contributions',    desc:'Restricted & unrestricted philanthropic gifts',  tracked:true,  mtd:1400000, share:44, trend:8  },
      { name:'Investment returns',     desc:'Returns on invested endowment pool',             tracked:true,  mtd:680000,  share:21, trend:12 },
      { name:'Corporate sponsorships', desc:'Named grants and programme sponsorships',         tracked:true,  mtd:530000,  share:17, trend:5  },
      { name:'Bilateral grants',       desc:'Government-to-government programme funding',      tracked:true,  mtd:380000,  share:12, trend:-2 },
      { name:'Crowdfunding',           desc:'Public online campaign revenue',                  tracked:false, mtd:130000,  share:4,  trend:35 },
      { name:'Social bond issuance',   desc:'Impact-linked bond proceeds',                    tracked:false, mtd:60000,   share:2,  trend:0  },
    ],
    rateCard: [
      { service:'Impact Advisory',     unit:'per engagement', rate:350000 },
      { service:'Fund Administration', unit:'per quarter',    rate:120000 },
      { service:'Due Diligence',       unit:'per investee',   rate:85000  },
      { service:'Impact Reporting',    unit:'per report',     rate:45000  },
    ],
    receivables: [
      { client:'USAID Kenya',          service:'Bilateral grant tranche 2',  amount:2400000, status:'Pending', due:'15 Aug 2026' },
      { client:'Safaricom Foundation', service:'Corporate sponsorship',      amount:800000,  status:'Pending', due:'01 Sep 2026' },
      { client:'Co-op Bank',           service:'Corporate sponsorship',      amount:600000,  status:'Overdue', due:'31 Mar 2026' },
      { client:'Diaspora donor pool',  service:'Crowdfunding disbursement',  amount:310000,  status:'Pending', due:'30 Jun 2026' },
      { client:'DANIDA',               service:'Impact advisory fee',        amount:175000,  status:'Paid',    due:'01 Jun 2026' },
    ],
    growth: [
      { p:"Q3 '25", cons:6.0, base:6.5, aggr:7.2  },
      { p:"Q4 '25", cons:6.6, base:7.5, aggr:8.6  },
      { p:"Q1 '26", cons:7.3, base:8.7, aggr:10.3 },
      { p:"Q2 '26", cons:8.1, base:10.1,aggr:12.4 },
      { p:"Q3 '26", cons:9.0, base:11.7,aggr:14.9 },
      { p:"Q4 '26", cons:9.9, base:13.5,aggr:17.9 },
      { p:"Q1 '27", cons:10.9,base:15.6,aggr:21.5 },
      { p:"Q2 '27", cons:12.0,base:18.1,aggr:25.8 },
    ],
    levers: [
      { k:'Fund AUM (projected)',   v:'KES 72.4M', note:'end of FY27' },
      { k:'Donor retention rate',  v:'84%',        note:'+6pp YoY improvement' },
      { k:'Grant disbursement rate',v:'91%',       note:'of committed funds' },
      { k:'Runway',                v:'22 mo',      note:'operating reserve' },
    ],
    innovationBoard: {
      Idea:      [{ t:'Blockchain-verified impact credentials for donors', o:'Fatima H.', impact:'High' }, { t:'AI grant-matching engine', o:'Wanjiku K.', impact:'High' }],
      Exploring: [{ t:'Donor DAF (Donor Advised Fund) product', o:'Fatima H.', impact:'High' }, { t:'Social bond listed on Nairobi Securities Exchange', o:'Wanjiku K.', impact:'Medium' }],
      Piloting:  [{ t:'Micro-crowdfunding via USSD for rural donors', o:'Wanjiku K.', impact:'High' }],
      Scaling:   [{ t:'Online impact dashboard for donor reporting', o:'Fatima H.', impact:'High' }],
      Parked:    [{ t:'Crypto donation wallet', o:'Wanjiku K.', impact:'Low' }],
    },
  },

  /* ═══════════════════════════ i3Studios ═══════════════════════════ */
  i3studios: {
    name: 'i³Studios',
    monthly: [
      { m:'Jan', goal:720000,  actual:650000  },
      { m:'Feb', goal:800000,  actual:820000  },
      { m:'Mar', goal:900000,  actual:970000  },
      { m:'Apr', goal:1000000, actual:890000  },
      { m:'May', goal:1100000, actual:1140000 },
      { m:'Jun', goal:1200000, actual:1020000 },
      { m:'Jul', goal:1300000, actual:null    },
      { m:'Aug', goal:1400000, actual:null    },
      { m:'Sep', goal:1500000, actual:null    },
      { m:'Oct', goal:1600000, actual:null    },
      { m:'Nov', goal:1700000, actual:null    },
      { m:'Dec', goal:1800000, actual:null    },
    ],
    projects: [
      { name:'Annual Summit Video',       owner:'Tom K.',   goal:'Deliver 3-part documentary series',        current:3,  target:3,  unit:'episodes',  status:'Completed', due:'May 2026' },
      { name:'Brand Identity Refresh',    owner:'Grace M.', goal:'Rebrand 5 Impact360 sub-brands',            current:3,  target:5,  unit:'brands',    status:'On track',  due:'Sep 2026' },
      { name:'YouTube Channel Launch',    owner:'Grace M.', goal:'Reach 10,000 subscribers in 6 months',     current:4200,target:10000,unit:'subs',    status:'At risk',   due:'Oct 2026' },
      { name:'Corporate Content Packages',owner:'Tom K.',   goal:'Sign 8 corporate content clients',         current:5,  target:8,  unit:'clients',   status:'On track',  due:'Nov 2026' },
      { name:'Podcast Series — S1',       owner:'Grace M.', goal:'Publish 12 episodes of African Builders',  current:7,  target:12, unit:'episodes',  status:'On track',  due:'Dec 2026' },
    ],
    losses: [
      { source:'Equipment downtime',    amount:120000, note:'Camera rig out of service for 3 weeks' },
      { source:'Project cancellations', amount:95000,  note:'2 corporate video shoots cancelled post-brief' },
      { source:'Talent no-show',        amount:60000,  note:'Freelance crew unavailable on shoot day' },
      { source:'Underpriced contracts', amount:45000,  note:'3 early contracts signed below market rate' },
    ],
    expenses: [
      { cat:'Talent & crew',           amount:380000 },
      { cat:'Equipment & studio',      amount:240000 },
      { cat:'Post-production software',amount:130000 },
      { cat:'Licensing & distribution',amount:95000  },
      { cat:'Marketing & PR',          amount:65000  },
      { cat:'Admin & misc',            amount:30000  },
    ],
    expTrend: [
      { m:'Jan', amount:860000 },{ m:'Feb', amount:890000 },{ m:'Mar', amount:940000 },
      { m:'Apr', amount:920000 },{ m:'May', amount:950000 },{ m:'Jun', amount:940000 },
    ],
    models: [
      { name:'Content production fees', desc:'Fixed-fee video and design project work',     tracked:true,  mtd:480000, share:40, trend:7  },
      { name:'Content licensing',       desc:'Royalties from re-licensed media assets',      tracked:true,  mtd:280000, share:23, trend:18 },
      { name:'Corporate packages',      desc:'Retainer-based branded content creation',      tracked:true,  mtd:240000, share:20, trend:11 },
      { name:'Studio hire',             desc:'Hourly and day-rate studio space rental',       tracked:true,  mtd:120000, share:10, trend:3  },
      { name:'Syndication & streaming', desc:'Revenue share from platform distribution',     tracked:false, mtd:60000,  share:5,  trend:25 },
      { name:'Merchandise',             desc:'Branded physical goods from media IPs',         tracked:false, mtd:24000,  share:2,  trend:0  },
    ],
    rateCard: [
      { service:'Video Production',     unit:'per project',  rate:280000 },
      { service:'Graphic Design',       unit:'per day',      rate:14000  },
      { service:'Photography',          unit:'per day',      rate:18000  },
      { service:'Studio Hire',          unit:'per hour',     rate:8500   },
      { service:'Monthly Brand Content',unit:'per month',    rate:120000 },
      { service:'Podcast Production',   unit:'per episode',  rate:35000  },
    ],
    receivables: [
      { client:'Safaricom Ltd',         service:'Brand content package',   amount:360000, status:'Pending', due:'15 Jul 2026' },
      { client:'Nation Media Group',    service:'Documentary licensing',   amount:210000, status:'Pending', due:'01 Aug 2026' },
      { client:'KenGen',                service:'Video production',        amount:280000, status:'Overdue', due:'30 Apr 2026' },
      { client:'Absa Bank Kenya',       service:'Photography (annual)',    amount:180000, status:'Paid',    due:'01 Jun 2026' },
      { client:'Kenya Tourism Board',   service:'Studio hire × 12',       amount:102000, status:'Pending', due:'30 Jul 2026' },
    ],
    growth: [
      { p:"Q3 '25", cons:2.2, base:2.4, aggr:2.7 },
      { p:"Q4 '25", cons:2.5, base:2.8, aggr:3.2 },
      { p:"Q1 '26", cons:2.8, base:3.2, aggr:3.9 },
      { p:"Q2 '26", cons:3.1, base:3.8, aggr:4.7 },
      { p:"Q3 '26", cons:3.4, base:4.4, aggr:5.6 },
      { p:"Q4 '26", cons:3.8, base:5.1, aggr:6.8 },
      { p:"Q1 '27", cons:4.2, base:5.9, aggr:8.1 },
      { p:"Q2 '27", cons:4.6, base:6.8, aggr:9.7 },
    ],
    levers: [
      { k:'Base-case ARR (proj.)', v:'KES 27.2M', note:'end of FY27' },
      { k:'Content output / month',v:'14 assets',  note:'+40% vs FY25' },
      { k:'Net revenue retention', v:'109%',        note:'expansion > churn' },
      { k:'Runway',                v:'12 mo',       note:'at current burn' },
    ],
    innovationBoard: {
      Idea:      [{ t:'AI-assisted video editing pipeline', o:'Grace M.', impact:'High' }, { t:'Interactive documentary format for social media', o:'Tom K.', impact:'Medium' }],
      Exploring: [{ t:'Short-film IP development fund', o:'Grace M.', impact:'High' }, { t:'AR brand experiences for events', o:'Tom K.', impact:'Medium' }],
      Piloting:  [{ t:'Podcast monetisation via Spotify & Apple', o:'Grace M.', impact:'High' }],
      Scaling:   [{ t:'Corporate content subscription model', o:'Tom K.', impact:'High' }],
      Parked:    [{ t:'NFT art collection from studio shoots', o:'Grace M.', impact:'Low' }],
    },
  },

  /* ═══════════════════════════ i3Launchpad ═══════════════════════════ */
  i3launchpad: {
    name: 'i3Launchpad',
    monthly: [
      { m:'Jan', goal:380000, actual:290000  },
      { m:'Feb', goal:420000, actual:380000  },
      { m:'Mar', goal:480000, actual:520000  },
      { m:'Apr', goal:540000, actual:450000  },
      { m:'May', goal:620000, actual:610000  },
      { m:'Jun', goal:700000, actual:580000  },
      { m:'Jul', goal:800000, actual:null    },
      { m:'Aug', goal:900000, actual:null    },
      { m:'Sep', goal:1000000,actual:null    },
      { m:'Oct', goal:1100000,actual:null    },
      { m:'Nov', goal:1200000,actual:null    },
      { m:'Dec', goal:1400000,actual:null    },
    ],
    projects: [
      { name:'Cohort 1 Onboarding',     owner:'James O.',  goal:'Accept 10 startups into Cohort 1',       current:10, target:10, unit:'startups',   status:'Completed', due:'Apr 2026' },
      { name:'Mentorship Programme',    owner:'James O.',  goal:'Pair all 10 startups with mentors',       current:8,  target:10, unit:'pairs',      status:'On track',  due:'Jul 2026' },
      { name:'Demo Day — June 2026',    owner:'TBD',       goal:'Demo Day with 15+ investor attendees',    current:11, target:15, unit:'investors',  status:'At risk',   due:'Aug 2026' },
      { name:'VC Partnership Pipeline', owner:'James O.',  goal:'MOU with 5 VC firms',                    current:2,  target:5,  unit:'MOUs',       status:'Behind',    due:'Oct 2026' },
      { name:'Cohort 2 Applications',   owner:'TBD',       goal:'Receive 80 qualified applications',       current:34, target:80, unit:'applications',status:'On track', due:'Nov 2026' },
    ],
    losses: [
      { source:'Startup dropout',        amount:90000, note:'2 startups exited Cohort 1 early' },
      { source:'Demo Day sponsor shortfall',amount:65000,note:'1 sponsor pulled out post-commitment' },
      { source:'Uncollected equity fees', amount:48000, note:'1 startup missed monthly advisory fee' },
    ],
    expenses: [
      { cat:'Programme staff',         amount:220000 },
      { cat:'Mentor honoraria',        amount:120000 },
      { cat:'Events & Demo Day',       amount:95000  },
      { cat:'Workspace & facilities',  amount:70000  },
      { cat:'Tech & tools',            amount:45000  },
      { cat:'Legal (equity docs)',     amount:30000  },
      { cat:'Admin & misc',            amount:20000  },
    ],
    expTrend: [
      { m:'Jan', amount:560000 },{ m:'Feb', amount:580000 },{ m:'Mar', amount:620000 },
      { m:'Apr', amount:600000 },{ m:'May', amount:610000 },{ m:'Jun', amount:600000 },
    ],
    models: [
      { name:'Accelerator programme fees',desc:'Per-cohort participation fee from startups',  tracked:true,  mtd:250000, share:40, trend:0  },
      { name:'Equity stakes',             desc:'Revenue from pro-rata equity agreements',      tracked:true,  mtd:180000, share:29, trend:10 },
      { name:'Sponsor & partner income',  desc:'Corporate sponsors of the programme',          tracked:true,  mtd:120000, share:19, trend:5  },
      { name:'Advisory retainers',        desc:'Monthly advisory fees post-programme',          tracked:false, mtd:60000,  share:10, trend:20 },
      { name:'Event ticket sales',        desc:'Demo Day investor & public tickets',            tracked:false, mtd:15000,  share:2,  trend:0  },
    ],
    rateCard: [
      { service:'Cohort Programme Fee',  unit:'per startup / cohort', rate:180000 },
      { service:'Advisory Retainer',     unit:'per month',            rate:25000  },
      { service:'Investor Matching',     unit:'per placement',        rate:95000  },
      { service:'Demo Day Ticket',       unit:'per person',           rate:5000   },
      { service:'VC Syndicate Access',   unit:'per deal',             rate:50000  },
    ],
    receivables: [
      { client:'Cohort 1 — 8 startups',  service:'Programme fees',       amount:1440000, status:'Pending', due:'30 Aug 2026' },
      { client:'Safaricom Spark',         service:'Programme sponsorship',amount:300000,  status:'Pending', due:'01 Sep 2026' },
      { client:'Sanergy Ltd',             service:'Advisory retainer',    amount:75000,   status:'Overdue', due:'30 Apr 2026' },
      { client:'Demo Day attendees',      service:'Ticket revenue',       amount:45000,   status:'Paid',    due:'15 Jun 2026' },
    ],
    growth: [
      { p:"Q3 '25", cons:1.1, base:1.3, aggr:1.5 },
      { p:"Q4 '25", cons:1.3, base:1.6, aggr:1.9 },
      { p:"Q1 '26", cons:1.5, base:1.9, aggr:2.4 },
      { p:"Q2 '26", cons:1.8, base:2.3, aggr:3.0 },
      { p:"Q3 '26", cons:2.1, base:2.8, aggr:3.7 },
      { p:"Q4 '26", cons:2.4, base:3.4, aggr:4.6 },
      { p:"Q1 '27", cons:2.8, base:4.1, aggr:5.7 },
      { p:"Q2 '27", cons:3.2, base:5.0, aggr:7.1 },
    ],
    levers: [
      { k:'Base-case ARR (proj.)',  v:'KES 20.0M', note:'end of FY27' },
      { k:'Startups per cohort',   v:'10–15',      note:'scaling in Cohort 2' },
      { k:'Portfolio survival rate',v:'80%',       note:'target at 12 months' },
      { k:'Runway',                v:'9 mo',       note:'raise underway' },
    ],
    innovationBoard: {
      Idea:      [{ t:'Revenue-based financing for portfolio startups', o:'James O.', impact:'High' }, { t:'Cross-cohort alumni network app', o:'TBD', impact:'Medium' }],
      Exploring: [{ t:'Launchpad Africa — regional expansion', o:'James O.', impact:'High' }],
      Piloting:  [{ t:'Cohort-based startup programme', o:'James O.', impact:'High' }],
      Scaling:   [],
      Parked:    [{ t:'Token-based equity system', o:'James O.', impact:'Low' }],
    },
  },

};

export default function DemoAgencyPage({ params }) {
  const router = useRouter();
  const { agencyId } = React.use(params);
  const data = DEMO_DATA[agencyId?.toLowerCase()] || null;
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      supabase
        .from('profiles')
        .select('id, full_name, email, role, approved, agency_id')
        .eq('id', user.id)
        .single()
        .then(({ data: profile }) => {
          const role        = profile?.role || user.user_metadata?.role || 'member';
          const agencySlug  = user.user_metadata?.agency || '';

          // Non-admins can only view their own agency
          if (role !== 'admin' && agencySlug && agencySlug !== agencyId?.toLowerCase()) {
            router.replace(`/demo/agencies/${agencySlug}`);
            return;
          }

          if (profile) {
            setUserProfile(profile);
          } else {
            setUserProfile({
              id: user.id,
              full_name: user.user_metadata?.full_name || '',
              email: user.email,
              role,
              approved: true,
              agency_id: null,
            });
          }
        });
    });
  }, [agencyId]);

  return <AgencyDashboardPage agencyId={agencyId} agencyData={data} userProfile={userProfile} />;
}
