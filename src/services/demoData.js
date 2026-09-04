export const demoDashboard = {
  profile: {
    userId: "demo-user",
    name: "Aarav Mehta",
    city: "New Delhi",
    weeklyEmissionTargetKg: 85,
    rewardPoints: 625
  },
  stats: {
    categoryTotals: {
      transportation: 42.6,
      energy: 31.4,
      lifestyle: 25.9
    },
    totalEmissionsKg: 99.9,
    recentWeeklyKg: 72.8,
    previousWeeklyKg: 84.1,
    carbonScore: 82,
    improvementPercent: 13.44
  },
  trend: [
    { date: "Jul 27", totalKg: 13.8, transportation: 5.2, energy: 4.4, lifestyle: 4.2 },
    { date: "Jul 28", totalKg: 11.9, transportation: 3.4, energy: 4.0, lifestyle: 4.5 },
    { date: "Jul 29", totalKg: 15.2, transportation: 6.1, energy: 4.6, lifestyle: 4.5 },
    { date: "Jul 30", totalKg: 10.7, transportation: 2.6, energy: 4.1, lifestyle: 4.0 },
    { date: "Jul 31", totalKg: 9.8, transportation: 2.1, energy: 3.8, lifestyle: 3.9 },
    { date: "Aug 1", totalKg: 8.9, transportation: 1.7, energy: 3.4, lifestyle: 3.8 },
    { date: "Aug 2", totalKg: 10.4, transportation: 2.8, energy: 3.6, lifestyle: 4.0 }
  ],
  forecast: [
    { date: "Aug 4", predictedKg: 10.2, model: "ARIMA/LSTM mock" },
    { date: "Aug 5", predictedKg: 9.9, model: "ARIMA/LSTM mock" },
    { date: "Aug 6", predictedKg: 9.6, model: "ARIMA/LSTM mock" },
    { date: "Aug 7", predictedKg: 9.1, model: "ARIMA/LSTM mock" },
    { date: "Aug 8", predictedKg: 8.8, model: "ARIMA/LSTM mock" },
    { date: "Aug 9", predictedKg: 8.4, model: "ARIMA/LSTM mock" },
    { date: "Aug 10", predictedKg: 8.1, model: "ARIMA/LSTM mock" }
  ],
  recommendations: [
    {
      category: "transportation",
      priority: "High",
      tips: [
        "Shift one short car trip to rail, bus, cycling, or walking this week.",
        "Cluster errands into fewer trips to reduce avoidable distance."
      ]
    },
    {
      category: "energy",
      priority: "Next",
      tips: ["Move high-load appliance use away from peak evening hours."]
    }
  ],
  badges: [
    { code: "first_manual_log", label: "First Log", earnedAt: "2026-05-01T10:00:00.000Z", description: "Unlocked milestone" },
    { code: "transit_trio", label: "Transit Trio", earnedAt: "2026-05-08T10:00:00.000Z", description: "Unlocked milestone" }
  ]
};
