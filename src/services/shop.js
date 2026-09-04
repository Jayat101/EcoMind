export const SHOP_ITEMS = [
  {
    id: "premium_week",
    name: "Premium Insights – 7 Days",
    description: "Unlock the extended 14-day forecast and category deep dive for one week.",
    points: 500,
    type: "premium",
    durationDays: 7,
    icon: "sparkles"
  },
  {
    id: "eco_ebook",
    name: "Eco Tips E-Book",
    description: "A practical 60-page guide to cutting your daily footprint.",
    points: 200,
    type: "item",
    icon: "book",
    content: {
      kind: "book",
      tagline: "A practical guide to a lighter footprint",
      sections: [
        {
          heading: "Getting Started",
          paragraphs: [
            "Small daily changes compound fast. Log every day so your footprint becomes visible, then pick one habit to improve each week.",
            "Target one category at a time — transport, energy, food, or shopping — and track how your weekly footprint responds.",
            "Progress, not perfection. A miss isn't a failure; it's a data point that tells you where to focus next.",
            "Set a weekly emission target that feels slightly challenging but still achievable, then measure against it every Sunday."
          ]
        },
        {
          heading: "Travel & Mobility",
          paragraphs: [
            "Swap short car trips (under 5 km) for walking, cycling, or the bus. One km on foot emits zero carbon.",
            "Combine errands into a single route to cut total distance, and consider the metro or shared EVs for longer commutes.",
            "When you must drive, keep the trip short, maintain tyre pressure, and avoid idling at signals.",
            "Plan for 'car-free Fridays' to build the habit — a single weekly habit can become permanent in a few months.",
            "Track the kilometres you 'earn' on foot or by bike; watching transport kilometres shrink week to week is deeply motivating."
          ]
        },
        {
          heading: "Home Energy",
          paragraphs: [
            "Set your AC to 24-26°C and use a fan to spread the cool air — every degree saved trims around 6% of cooling energy.",
            "Use the geyser timer so it heats only when you need it, and wash laundry in full loads during off-peak hours.",
            "Unplug standby-heavy devices (TVs, routers, chargers) at night to cut hidden energy use.",
            "Use curtains and cross-ventilation in the morning to delay turning on cooling altogether.",
            "If you have solar or an inverter, shift your washing and ironing to daylight hours when generation is highest."
          ]
        },
        {
          heading: "Food & Diet",
          paragraphs: [
            "Move toward plant-forward meals — replacing a few meat-heavy dishes a week meaningfully lowers your food footprint.",
            "Skip one takeout order per week; cooking at home avoids packaging and delivery emissions.",
            "Plan meals and store leftovers to reduce food waste, one of the biggest sources of avoidable emissions.",
            "Choose locally-sourced, seasonal produce to cut the transport and refrigeration burden behind imported goods.",
            "Batch-cook on the weekend so the easiest meal on a busy weekday is also the greenest one."
          ]
        },
        {
          heading: "Shopping & Lifestyle",
          paragraphs: [
            "Use the 24-hour rule: wait a day before any non-essential purchase. Most impulse buys fade within a day.",
            "Buy fewer, better things — repair and reuse before replacing, and rent or borrow items you rarely need.",
            "Favour local and durable products to cut shipping and packaging emissions.",
            "Declutter mindfully: sell or donate what you no longer use instead of buying duplicates.",
            "Track your 'no-shopping' days and celebrate a retail-free week as a genuine sustainability win."
          ]
        },
        {
          heading: "Waste & Recycling",
          paragraphs: [
            "Segregate waste at source — dry, wet, and hazardous — so more of it gets recycled instead of landfilled.",
            "Compost kitchen waste at home or via a neighbourhood composter; it turns food scraps into soil instead of methane.",
            "Carry a reusable bag and bottle every day to avoid single-use plastics.",
            "Switch to refill stations for cleaning products and staples to shrink packaging volumes dramatically.",
            "Keep a small 'repair box' for broken items and try one easy fix before buying again."
          ]
        },
        {
          heading: "Water & Daily Habits",
          paragraphs: [
            "Take shorter showers and turn off the tap while brushing — every litre of heated or treated water counts.",
            "Run the dishwasher and washing machine only when full to maximise every load.",
            "Fix dripping taps promptly; a slow leak can waste thousands of litres a year.",
            "Use a bucket and timer while gardening so water goes where the plants need it most."
          ]
        },
        {
          heading: "Tracking & Consistency",
          paragraphs: [
            "Log daily, even on imperfect days — consistency gives you a trustworthy picture of your real footprint.",
            "Review a weekly summary of your transport, energy, and diet categories to see where you save the most.",
            "Protect a day check-in habit — it is easier to keep a streak than to rebuild a lost one.",
            "Set a small improvement goal each week, like 'two car-free days', and log whether you hit it."
          ]
        },
        {
          heading: "Community & Accountability",
          paragraphs: [
            "Share your weekly footprint with a friend or family member — talking about it makes the habit stick.",
            "Join community challenges and watch the leaderboard for a friendly nudge to stay consistent.",
            "Reward yourself after a strong low-carbon week; a little celebration keeps motivation high.",
            "Invite others to join — a shared goal is far more likely to be sustained than a solitary resolve."
          ]
        },
        {
          heading: "Seasonal & Climate Tips",
          paragraphs: [
            "Summer: shade your home before it heats up and wash a load of clothes in the evening instead of at peak heat.",
            "Monsoon: use rain barrels for plants and skip the dryer — high humidity dries clothes almost as fast.",
            "Winter: dress in layers and run the geyser timer for half the usual duration.",
            "Festival season: reuse gift wrap, host a low-waste gathering, and gift experiences instead of packaged goods."
          ]
        },
        {
          heading: "Common Myths, Busted",
          paragraphs: [
            "Myth: 'My individual actions are too small to matter.' Reality: household choices shape almost a third of global emissions.",
            "Myth: 'Plant-based meals are expensive.' Reality: lentils, beans, and seasonal vegetables are often the cheapest staples.",
            "Myth: 'Recycling is pointless.' Reality: separating dry waste correctly dramatically boosts the share that gets recycled.",
            "Myth: 'It has to be perfect.' Reality: a 20% cut you sustain beats a 90% cut you abandon within a fortnight."
          ]
        },
        {
          heading: "Your 90-Day Plan",
          paragraphs: [
            "Weeks 1-2: Build the logging habit. Observe how your footprint breaks down across transport and energy.",
            "Weeks 3-6: Focus on the single largest category you logged — try to cut it by around a quarter.",
            "Weeks 7-10: Layer in food and shopping choices, and start a car-free or plant-forward routine.",
            "Weeks 11-13: Review your data, celebrate your best week, and set a stretch target for the next quarter."
          ]
        }
      ]
    }
  },
  {
    id: "custom_theme",
    name: "Eco Theme Pack",
    description: "Unlock the premium Sienna earth theme — warm clay, copper and stone surfaces across EcoMind.",
    points: 300,
    type: "item",
    icon: "palette",
    theme: {
      id: "earth",
      name: "Sienna Earth",
      palette: ["#b3552e", "#8a3a1c", "#e8b892", "#f9f3e8", "#2b251d"]
    }
  },
  {
    id: "streak_freeze",
    name: "Streak Freeze",
    description: "Protect your logging streak for one day. If you miss a check-in, your streak is preserved automatically.",
    points: 500,
    type: "item",
    icon: "snowflake"
  },
  {
    id: "premium_month",
    name: "Premium Insights – 30 Days",
    description: "A month of extended forecast, deep-dive analytics, and priority tips.",
    points: 1600,
    type: "premium",
    durationDays: 30,
    icon: "star"
  },
  {
    id: "offset_certificate",
    name: "Carbon Offset Certificate",
    description: "A printable certificate for 100 kg CO2e offset on your behalf.",
    points: 1500,
    type: "item",
    icon: "certificate",
    content: {
      kind: "certificate",
      tagline: "Carbon Offset Certificate",
      offsetKg: 100,
      note: "This certificate acknowledges a verified mock offset of 100 kg CO2e in support of low-carbon living."
    }
  }
];

export function getShopCatalog() {
  return SHOP_ITEMS.slice();
}

export function findShopItem(itemId) {
  return SHOP_ITEMS.find((item) => item.id === itemId) ?? null;
}

export function computePremiumUntil(durationDays) {
  return new Date(Date.now() + durationDays * 86400000).toISOString();
}
