// ===== 05-seed-data.js =====
// ============================================================================
// SEED DATA — starter/demo datasets used only on first run (no saved data yet)
// or when "Load Demo Data" is clicked. Safe to delete in a real deployment;
// nothing else depends on these besides the initial-load fallbacks in 99-app.js.
// ============================================================================
// ---------------- Seed data ----------------
function seedUsers() {
  return [{
    id: uid("user"),
    username: "admin",
    password: "admin123",
    name: "Lab Administrator",
    role: "Administrator"
  }, {
    id: uid("user"),
    username: "tester",
    password: "tester123",
    name: "Lab Technician",
    role: "Technician"
  }];
}
// Master Chemical List — Admin-controlled list of approved chemical names. New chemicals in
// Inventory must be picked from here (not free-typed) so the same chemical can't be added twice.
const DEFAULT_MASTER_CHEMICALS = ["HCl", "HNO3", "NaOH", "KI", "NaBH4", "H2SO4", "EDTA", "Fe Standard", "Cl2 Standard", "Phenolphthalein Indicator", "Starch Indicator", "Ammonium Molybdate", "Ascorbic Acid"];
function seedChemicals() {
  return [{
    id: uid("chem"),
    name: "Fe Standard",
    unit: "ml",
    batches: [{
      id: uid("batch"),
      batchName: "FeStd-2026-01",
      dateReceived: "2026-01-10",
      expiryDate: "2026-07-15",
      initialAmount: 500,
      remaining: 120,
      status: "active",
      origin: "Central Reagent Store",
      receivedFrom: "DPHE Water Safety Project"
    }, {
      id: uid("batch"),
      batchName: "FeStd-2026-05",
      dateReceived: "2026-05-02",
      expiryDate: "2027-01-02",
      initialAmount: 500,
      remaining: 500,
      status: "active",
      origin: "Central Reagent Store",
      receivedFrom: "DPHE Water Safety Project"
    }]
  }, {
    id: uid("chem"),
    name: "HCl",
    unit: "ml",
    batches: [{
      id: uid("batch"),
      batchName: "HCl-2025-11",
      dateReceived: "2025-11-01",
      expiryDate: "2026-06-20",
      initialAmount: 1000,
      remaining: 300,
      status: "active",
      origin: "Local Chemical Supplier",
      receivedFrom: "Zonal Office Procurement"
    }, {
      id: uid("batch"),
      batchName: "HCl-2026-03",
      dateReceived: "2026-03-15",
      expiryDate: "2026-12-31",
      initialAmount: 1000,
      remaining: 1000,
      status: "active",
      origin: "Local Chemical Supplier",
      receivedFrom: "Zonal Office Procurement"
    }]
  }];
}
function seedTestTypes(chemicals, equipment, gasList) {
  const feStd = chemicals.find(c => c.name === "Fe Standard");
  const hcl = chemicals.find(c => c.name === "HCl");
  const spectro = (equipment || []).find(e => e.name === "UV-Vis Spectrophotometer");
  const acetylene = (gasList || []).find(g => g.name === "Acetylene");
  return [{
    id: uid("test"),
    testName: "Iron Test",
    method: "Fe",
    name: "Iron Test-Fe",
    costPerTest: 100,
    feeApplicable: true,
    defaultEquipmentId: spectro?.id || "",
    chemicalRequirements: [{
      chemicalId: feStd?.id,
      chemical: feStd?.name || "Fe Standard",
      items: [{
        id: uid("item"),
        label: "Fe Mother Solution",
        type: "direct",
        defaultValue: 5
      }, {
        id: uid("item"),
        label: "Wastage",
        type: "direct",
        defaultValue: 1
      }]
    }, {
      chemicalId: hcl?.id,
      chemical: hcl?.name || "HCl",
      items: [{
        id: uid("item"),
        label: "Sample Preparation",
        type: "sampleAmount",
        amountLabel: "HCl required per sample (ml)",
        defaultAmount: 2,
        sampleSource: "field"
      }, {
        id: uid("item"),
        label: "Standard Preparation",
        type: "sampleAmount",
        amountLabel: "HCl required per standard (ml)",
        defaultAmount: 2,
        sampleSource: "standard"
      }, {
        id: uid("item"),
        label: "Wastage",
        type: "direct",
        defaultValue: 1
      }]
    }],
    gasRequirements: acetylene ? [{
      gasId: acetylene.id,
      gasName: acetylene.name
    }] : [],
    dilutionEnabled: true,
    dilutionChemicalRequirements: hcl ? [{
      chemicalId: hcl.id,
      chemical: hcl.name,
      items: [{
        id: uid("item"),
        label: "Extra HCl for Dilution",
        type: "sampleAmount",
        amountLabel: "HCl required per diluted sample (ml)",
        defaultAmount: 1
      }]
    }] : [],
    dilutionGasRequirements: []
  }];
}
function seedGlassware() {
  return [{
    id: uid("glass"),
    name: "Volumetric Flask 100ml",
    dateReceived: "2025-09-01",
    totalQuantity: 20,
    inUse: 6,
    broken: 1,
    origin: "Central Glassware Store",
    receivedFrom: "DPHE Water Safety Project"
  }, {
    id: uid("glass"),
    name: "Burette 50ml",
    dateReceived: "2025-09-01",
    totalQuantity: 10,
    inUse: 2,
    broken: 0,
    origin: "Central Glassware Store",
    receivedFrom: "DPHE Water Safety Project"
  }];
}
function seedGas() {
  return [{
    id: uid("gas"),
    name: "Acetylene",
    unit: "kg",
    cylinders: [{
      id: uid("cyl"),
      name: "Acetylene-C1",
      dateReceived: "2026-02-01",
      capacity: 40,
      remaining: 6,
      status: "active",
      origin: "Bangladesh Oxygen Ltd.",
      receivedFrom: "Zonal Office Procurement",
      history: [{
        id: uid("gevt"),
        date: "2026-02-01",
        type: "new",
        amount: 40,
        cost: 0,
        note: "New cylinder received"
      }]
    }]
  }, {
    id: uid("gas"),
    name: "Argon",
    unit: "kg",
    cylinders: [{
      id: uid("cyl"),
      name: "Argon-C1",
      dateReceived: "2026-01-15",
      capacity: 50,
      remaining: 45,
      status: "active",
      origin: "Bangladesh Oxygen Ltd.",
      receivedFrom: "DPHE Water Safety Project",
      history: [{
        id: uid("gevt"),
        date: "2026-01-15",
        type: "new",
        amount: 50,
        cost: 0,
        note: "New cylinder received"
      }]
    }]
  }];
}
function seedEquipment() {
  return [{
    id: uid("equip"),
    name: "UV-Vis Spectrophotometer",
    dateReceived: "2024-06-01",
    origin: "Manufacturer — HACH",
    receivedFrom: "DPHE Water Safety Project",
    functional: true,
    history: [{
      id: uid("evt"),
      date: "2026-03-10",
      type: "breakdown",
      description: "Lamp not igniting",
      cost: 0,
      functionalAfter: false
    }, {
      id: uid("evt"),
      date: "2026-03-18",
      type: "repair",
      description: "Replaced UV lamp",
      cost: 4500,
      functionalAfter: true
    }]
  }, {
    id: uid("equip"),
    name: "Digital pH Meter",
    dateReceived: "2025-01-15",
    origin: "Manufacturer — HANNA",
    receivedFrom: "Zonal Office Procurement",
    functional: true,
    history: []
  }];
}

// ---------------- Demo Report Dataset (Arsenic / Iron / Manganese / Chloride) ----------------
// Builds a self-consistent set of chemicals, equipment, gas cylinders, test types and 15 test
// records so the Reports & Analytics module has realistic data to visualize immediately.
function buildDemoReportData() {
  const feStdB1 = uid("batch"),
    feStdB2 = uid("batch");
  const hclB1 = uid("batch"),
    hclB2 = uid("batch");
  const naBH4B1 = uid("batch");
  const kiB1 = uid("batch");
  const mnStdB1 = uid("batch");
  const h2so4B1 = uid("batch");
  const agno3B1 = uid("batch");
  const cl2StdB1 = uid("batch");
  const chemicals = [{
    id: uid("chem"),
    name: "Fe Standard",
    unit: "ml",
    batches: [{
      id: feStdB1,
      batchName: "FeStd-2026-01",
      dateReceived: "2026-01-10",
      expiryDate: "2026-07-15",
      initialAmount: 500,
      remaining: 38,
      status: "active",
      origin: "Central Reagent Store",
      receivedFrom: "DPHE Water Safety Project"
    }, {
      id: feStdB2,
      batchName: "FeStd-2026-05",
      dateReceived: "2026-05-02",
      expiryDate: "2027-01-02",
      initialAmount: 500,
      remaining: 460,
      status: "active",
      origin: "Central Reagent Store",
      receivedFrom: "DPHE Water Safety Project"
    }]
  }, {
    id: uid("chem"),
    name: "HCl",
    unit: "ml",
    batches: [{
      id: hclB1,
      batchName: "HCl-2025-11",
      dateReceived: "2025-11-01",
      expiryDate: "2026-06-20",
      initialAmount: 1000,
      remaining: 260,
      status: "active",
      origin: "Local Chemical Supplier",
      receivedFrom: "Zonal Office Procurement"
    }, {
      id: hclB2,
      batchName: "HCl-2026-03",
      dateReceived: "2026-03-15",
      expiryDate: "2026-12-31",
      initialAmount: 1000,
      remaining: 905,
      status: "active",
      origin: "Local Chemical Supplier",
      receivedFrom: "Zonal Office Procurement"
    }]
  }, {
    id: uid("chem"),
    name: "NaBH4",
    unit: "g",
    batches: [{
      id: naBH4B1,
      batchName: "NaBH4-2026-02",
      dateReceived: "2026-02-01",
      expiryDate: "2026-08-05",
      initialAmount: 200,
      remaining: 17,
      status: "active",
      origin: "Central Reagent Store",
      receivedFrom: "DPHE Water Safety Project"
    }]
  }, {
    id: uid("chem"),
    name: "KI",
    unit: "g",
    batches: [{
      id: kiB1,
      batchName: "KI-2026-02",
      dateReceived: "2026-02-01",
      expiryDate: "2027-02-01",
      initialAmount: 150,
      remaining: 96,
      status: "active",
      origin: "Central Reagent Store",
      receivedFrom: "DPHE Water Safety Project"
    }]
  }, {
    id: uid("chem"),
    name: "Mn Standard",
    unit: "ml",
    batches: [{
      id: mnStdB1,
      batchName: "MnStd-2026-03",
      dateReceived: "2026-03-05",
      expiryDate: "2027-03-05",
      initialAmount: 300,
      remaining: 224,
      status: "active",
      origin: "Central Reagent Store",
      receivedFrom: "DPHE Water Safety Project"
    }]
  }, {
    id: uid("chem"),
    name: "H2SO4",
    unit: "ml",
    batches: [{
      id: h2so4B1,
      batchName: "H2SO4-2026-01",
      dateReceived: "2026-01-20",
      expiryDate: "2027-01-20",
      initialAmount: 500,
      remaining: 341,
      status: "active",
      origin: "Local Chemical Supplier",
      receivedFrom: "Zonal Office Procurement"
    }]
  }, {
    id: uid("chem"),
    name: "AgNO3",
    unit: "ml",
    batches: [{
      id: agno3B1,
      batchName: "AgNO3-2026-02",
      dateReceived: "2026-02-10",
      expiryDate: "2027-02-10",
      initialAmount: 250,
      remaining: 158,
      status: "active",
      origin: "Central Reagent Store",
      receivedFrom: "DPHE Water Safety Project"
    }]
  }, {
    id: uid("chem"),
    name: "Cl2 Standard",
    unit: "ml",
    batches: [{
      id: cl2StdB1,
      batchName: "Cl2Std-2026-02",
      dateReceived: "2026-02-10",
      expiryDate: "2027-02-10",
      initialAmount: 200,
      remaining: 147,
      status: "active",
      origin: "Central Reagent Store",
      receivedFrom: "DPHE Water Safety Project"
    }]
  }];
  const equipment = [{
    id: uid("equip"),
    name: "UV-Vis Spectrophotometer",
    dateReceived: "2024-06-01",
    origin: "Manufacturer — HACH",
    receivedFrom: "DPHE Water Safety Project",
    functional: true,
    history: [{
      id: uid("evt"),
      date: "2026-05-10",
      type: "breakdown",
      description: "Lamp not igniting",
      cost: 0,
      functionalAfter: false
    }, {
      id: uid("evt"),
      date: "2026-05-14",
      type: "repair",
      description: "Replaced UV lamp",
      cost: 4500,
      functionalAfter: true
    }]
  }, {
    id: uid("equip"),
    name: "Digital pH Meter",
    dateReceived: "2025-01-15",
    origin: "Manufacturer — HANNA",
    receivedFrom: "Zonal Office Procurement",
    functional: true,
    history: []
  }, {
    id: uid("equip"),
    name: "AAS – Hydride Generation Unit",
    dateReceived: "2025-04-01",
    origin: "Manufacturer — Thermo Fisher",
    receivedFrom: "DPHE Water Safety Project",
    functional: true,
    history: [{
      id: uid("evt"),
      date: "2026-06-01",
      type: "breakdown",
      description: "Argon flow irregular",
      cost: 0,
      functionalAfter: false
    }, {
      id: uid("evt"),
      date: "2026-06-04",
      type: "repair",
      description: "Replaced flow regulator",
      cost: 3200,
      functionalAfter: true
    }]
  }, {
    id: uid("equip"),
    name: "Titration Assembly",
    dateReceived: "2024-11-01",
    origin: "Central Glassware Store",
    receivedFrom: "Zonal Office Procurement",
    functional: true,
    history: []
  }];
  const gasList = [{
    id: uid("gas"),
    name: "Acetylene",
    unit: "kg",
    cylinders: [{
      id: uid("cyl"),
      name: "Acetylene-C1",
      dateReceived: "2026-02-01",
      capacity: 40,
      remaining: 6,
      status: "active",
      origin: "Bangladesh Oxygen Ltd.",
      receivedFrom: "Zonal Office Procurement",
      history: [{
        id: uid("gevt"),
        date: "2026-02-01",
        type: "new",
        amount: 40,
        cost: 0,
        note: "New cylinder received"
      }]
    }]
  }, {
    id: uid("gas"),
    name: "Argon",
    unit: "kg",
    cylinders: [{
      id: uid("cyl"),
      name: "Argon-C1",
      dateReceived: "2026-01-15",
      capacity: 50,
      remaining: 34,
      status: "active",
      origin: "Bangladesh Oxygen Ltd.",
      receivedFrom: "DPHE Water Safety Project",
      history: [{
        id: uid("gevt"),
        date: "2026-01-15",
        type: "new",
        amount: 50,
        cost: 0,
        note: "New cylinder received"
      }, {
        id: uid("gevt"),
        date: "2026-06-20",
        type: "refill",
        amount: 25,
        cost: 2800,
        note: "Routine refill"
      }]
    }]
  }];
  const uvvis = equipment.find(e => e.name === "UV-Vis Spectrophotometer");
  const aas = equipment.find(e => e.name === "AAS – Hydride Generation Unit");
  const titration = equipment.find(e => e.name === "Titration Assembly");
  const argon = gasList.find(g => g.name === "Argon");
  const feStd = chemicals.find(c => c.name === "Fe Standard");
  const hcl = chemicals.find(c => c.name === "HCl");
  const naBH4 = chemicals.find(c => c.name === "NaBH4");
  const ki = chemicals.find(c => c.name === "KI");
  const mnStd = chemicals.find(c => c.name === "Mn Standard");
  const h2so4 = chemicals.find(c => c.name === "H2SO4");
  const agno3 = chemicals.find(c => c.name === "AgNO3");
  const cl2Std = chemicals.find(c => c.name === "Cl2 Standard");
  const testTypes = [{
    id: uid("test"),
    testName: "Arsenic Test",
    method: "HVG-AAS",
    name: "Arsenic Test-HVG-AAS",
    costPerTest: 150,
    feeApplicable: true,
    defaultEquipmentId: aas?.id || "",
    chemicalRequirements: [{
      chemicalId: naBH4?.id,
      chemical: naBH4?.name || "NaBH4",
      items: [{
        id: uid("item"),
        label: "NaBH4 Reducing Solution",
        type: "sampleAmount",
        amountLabel: "NaBH4 required per sample (g)",
        defaultAmount: 3,
        sampleSource: "field"
      }, {
        id: uid("item"),
        label: "Wastage",
        type: "direct",
        defaultValue: 1
      }]
    }, {
      chemicalId: hcl?.id,
      chemical: hcl?.name || "HCl",
      items: [{
        id: uid("item"),
        label: "Acidification",
        type: "sampleAmount",
        amountLabel: "HCl required per sample (ml)",
        defaultAmount: 2,
        sampleSource: "field"
      }, {
        id: uid("item"),
        label: "Wastage",
        type: "direct",
        defaultValue: 0.5
      }]
    }, {
      chemicalId: ki?.id,
      chemical: ki?.name || "KI",
      items: [{
        id: uid("item"),
        label: "Pre-reductant (KI)",
        type: "sampleAmount",
        amountLabel: "KI required per sample (g)",
        defaultAmount: 1,
        sampleSource: "field"
      }]
    }],
    gasRequirements: argon ? [{
      gasId: argon.id,
      gasName: argon.name
    }] : [],
    dilutionEnabled: true,
    dilutionChemicalRequirements: naBH4 ? [{
      chemicalId: naBH4.id,
      chemical: naBH4.name,
      items: [{
        id: uid("item"),
        label: "Extra NaBH4 for Dilution",
        type: "sampleAmount",
        amountLabel: "NaBH4 required per diluted sample (g)",
        defaultAmount: 1
      }]
    }] : [],
    dilutionGasRequirements: argon ? [{
      gasId: argon.id,
      gasName: argon.name
    }] : []
  }, {
    id: uid("test"),
    testName: "Iron Test",
    method: "Fe",
    name: "Iron Test-Fe",
    costPerTest: 100,
    feeApplicable: true,
    defaultEquipmentId: uvvis?.id || "",
    chemicalRequirements: [{
      chemicalId: feStd?.id,
      chemical: feStd?.name || "Fe Standard",
      items: [{
        id: uid("item"),
        label: "Fe Mother Solution",
        type: "direct",
        defaultValue: 5
      }, {
        id: uid("item"),
        label: "Wastage",
        type: "direct",
        defaultValue: 1
      }]
    }, {
      chemicalId: hcl?.id,
      chemical: hcl?.name || "HCl",
      items: [{
        id: uid("item"),
        label: "Sample Preparation",
        type: "sampleAmount",
        amountLabel: "HCl required per sample (ml)",
        defaultAmount: 2,
        sampleSource: "field"
      }, {
        id: uid("item"),
        label: "Standard Preparation",
        type: "sampleAmount",
        amountLabel: "HCl required per standard (ml)",
        defaultAmount: 2,
        sampleSource: "standard"
      }, {
        id: uid("item"),
        label: "Wastage",
        type: "direct",
        defaultValue: 1
      }]
    }],
    gasRequirements: [],
    dilutionEnabled: true,
    dilutionChemicalRequirements: hcl ? [{
      chemicalId: hcl.id,
      chemical: hcl.name,
      items: [{
        id: uid("item"),
        label: "Extra HCl for Dilution",
        type: "sampleAmount",
        amountLabel: "HCl required per diluted sample (ml)",
        defaultAmount: 1
      }]
    }] : [],
    dilutionGasRequirements: []
  }, {
    id: uid("test"),
    testName: "Manganese Test",
    method: "Persulfate-UV",
    name: "Manganese Test-Persulfate-UV",
    costPerTest: 120,
    feeApplicable: true,
    defaultEquipmentId: uvvis?.id || "",
    chemicalRequirements: [{
      chemicalId: mnStd?.id,
      chemical: mnStd?.name || "Mn Standard",
      items: [{
        id: uid("item"),
        label: "Mn Mother Solution",
        type: "direct",
        defaultValue: 4
      }, {
        id: uid("item"),
        label: "Wastage",
        type: "direct",
        defaultValue: 1
      }]
    }, {
      chemicalId: h2so4?.id,
      chemical: h2so4?.name || "H2SO4",
      items: [{
        id: uid("item"),
        label: "Acid Digestion",
        type: "sampleAmount",
        amountLabel: "H2SO4 required per sample (ml)",
        defaultAmount: 3,
        sampleSource: "field"
      }, {
        id: uid("item"),
        label: "Wastage",
        type: "direct",
        defaultValue: 0.5
      }]
    }],
    gasRequirements: [],
    dilutionEnabled: true,
    dilutionChemicalRequirements: h2so4 ? [{
      chemicalId: h2so4.id,
      chemical: h2so4.name,
      items: [{
        id: uid("item"),
        label: "Extra H2SO4 for Dilution",
        type: "sampleAmount",
        amountLabel: "H2SO4 required per diluted sample (ml)",
        defaultAmount: 1
      }]
    }] : [],
    dilutionGasRequirements: []
  }, {
    id: uid("test"),
    testName: "Chloride Test",
    method: "Argentometric",
    name: "Chloride Test-Argentometric",
    costPerTest: 80,
    feeApplicable: true,
    defaultEquipmentId: titration?.id || "",
    chemicalRequirements: [{
      chemicalId: agno3?.id,
      chemical: agno3?.name || "AgNO3",
      items: [{
        id: uid("item"),
        label: "AgNO3 Titrant",
        type: "sampleAmount",
        amountLabel: "AgNO3 required per sample (ml)",
        defaultAmount: 4,
        sampleSource: "field"
      }, {
        id: uid("item"),
        label: "Wastage",
        type: "direct",
        defaultValue: 1
      }]
    }, {
      chemicalId: cl2Std?.id,
      chemical: cl2Std?.name || "Cl2 Standard",
      items: [{
        id: uid("item"),
        label: "Standardization",
        type: "sampleAmount",
        amountLabel: "Cl2 Standard required per standard (ml)",
        defaultAmount: 3,
        sampleSource: "standard"
      }]
    }],
    gasRequirements: [],
    dilutionEnabled: false,
    dilutionChemicalRequirements: [],
    dilutionGasRequirements: []
  }];
  const arsenicT = testTypes.find(t => t.testName === "Arsenic Test");
  const ironT = testTypes.find(t => t.testName === "Iron Test");
  const mnT = testTypes.find(t => t.testName === "Manganese Test");
  const clT = testTypes.find(t => t.testName === "Chloride Test");
  const TECHS = ["Rina Akter", "Shahin Mia", "Farzana Yasmin"];
  const SOURCES = ["Deep Tubewell", "Shallow Tubewell", "Pond Sand Filter", "Piped Water Supply"];
  function rec({
    date,
    tester,
    type,
    equip,
    field,
    std,
    source,
    unitCost,
    dilutedFrac,
    chemUse,
    gasAmt,
    dilGasAmt,
    override
  }) {
    const billed = field;
    const revenue = billed * unitCost;
    const dilutionRequired = !!dilutedFrac;
    const numberOfDilutedSamples = dilutionRequired ? Math.max(1, Math.round(field * dilutedFrac)) : 0;
    const consumption = {};
    const bottleLog = {};
    Object.entries(chemUse).forEach(([chemName, amt]) => {
      consumption[chemName] = amt;
      const chem = chemicals.find(c => c.name === chemName);
      const batch = chem && chem.batches[0];
      if (batch) bottleLog[chemName] = [{
        batchId: batch.id,
        amount: amt
      }];
    });
    const gasesUsed = gasAmt ? [{
      gasId: argon.id,
      gasName: "Argon",
      amount: gasAmt
    }] : [];
    const dilutionGasesUsed = dilGasAmt ? [{
      gasId: argon.id,
      gasName: "Argon",
      amount: dilGasAmt
    }] : [];
    return {
      id: uid("rec"),
      date,
      tester,
      testTypeId: type.id,
      testTypeName: type.testName,
      equipmentId: equip.id,
      equipmentName: equip.name,
      consumption,
      bottleLog,
      numberOfSamples: field + std,
      numberOfStandardSamples: std,
      numberOfFieldSamples: field,
      sampleSource: source,
      feeApplicable: true,
      unitCost,
      billedSamples: billed,
      revenue,
      dilutionRequired,
      numberOfDilutedSamples,
      dilutionGasesUsed,
      gasesUsed,
      gasLog: [],
      optionalUsed: [],
      expiredOverrides: override ? [{
        chemical: override,
        note: "Used near-expiry batch under supervisor approval"
      }] : []
    };
  }
  const testRecords = [
  // Arsenic (As) — 4 records, HVG-AAS, Argon gas
  rec({
    date: "2026-05-04",
    tester: TECHS[0],
    type: arsenicT,
    equip: aas,
    field: 8,
    std: 2,
    source: SOURCES[0],
    unitCost: 150,
    dilutedFrac: 0.25,
    chemUse: {
      NaBH4: 25,
      HCl: 17,
      KI: 8
    },
    gasAmt: 2.4
  }), rec({
    date: "2026-05-20",
    tester: TECHS[1],
    type: arsenicT,
    equip: aas,
    field: 6,
    std: 1,
    source: SOURCES[1],
    unitCost: 150,
    dilutedFrac: 0,
    chemUse: {
      NaBH4: 19,
      HCl: 12.5,
      KI: 6
    },
    gasAmt: 1.8
  }), rec({
    date: "2026-06-10",
    tester: TECHS[0],
    type: arsenicT,
    equip: aas,
    field: 10,
    std: 2,
    source: SOURCES[2],
    unitCost: 150,
    dilutedFrac: 0.3,
    chemUse: {
      NaBH4: 31,
      HCl: 20.5,
      KI: 10
    },
    gasAmt: 3,
    dilGasAmt: 0.6
  }), rec({
    date: "2026-07-08",
    tester: TECHS[2],
    type: arsenicT,
    equip: aas,
    field: 7,
    std: 2,
    source: SOURCES[0],
    unitCost: 150,
    dilutedFrac: 0,
    chemUse: {
      NaBH4: 22,
      HCl: 14.5,
      KI: 7
    },
    gasAmt: 2.1,
    override: "KI"
  }),
  // Iron (Fe) — 4 records, UV-Vis
  rec({
    date: "2026-05-06",
    tester: TECHS[1],
    type: ironT,
    equip: uvvis,
    field: 9,
    std: 2,
    source: SOURCES[1],
    unitCost: 100,
    dilutedFrac: 0.2,
    chemUse: {
      "Fe Standard": 6,
      HCl: 21
    }
  }), rec({
    date: "2026-05-25",
    tester: TECHS[0],
    type: ironT,
    equip: uvvis,
    field: 11,
    std: 3,
    source: SOURCES[3],
    unitCost: 100,
    dilutedFrac: 0,
    chemUse: {
      "Fe Standard": 6,
      HCl: 27
    }
  }), rec({
    date: "2026-06-15",
    tester: TECHS[2],
    type: ironT,
    equip: uvvis,
    field: 8,
    std: 2,
    source: SOURCES[0],
    unitCost: 100,
    dilutedFrac: 0.15,
    chemUse: {
      "Fe Standard": 6,
      HCl: 19
    }
  }), rec({
    date: "2026-07-10",
    tester: TECHS[1],
    type: ironT,
    equip: uvvis,
    field: 12,
    std: 2,
    source: SOURCES[2],
    unitCost: 100,
    dilutedFrac: 0,
    chemUse: {
      "Fe Standard": 6,
      HCl: 28
    }
  }),
  // Manganese (Mn) — 3 records, UV-Vis
  rec({
    date: "2026-05-12",
    tester: TECHS[2],
    type: mnT,
    equip: uvvis,
    field: 7,
    std: 2,
    source: SOURCES[1],
    unitCost: 120,
    dilutedFrac: 0.3,
    chemUse: {
      "Mn Standard": 5,
      H2SO4: 21.5
    }
  }), rec({
    date: "2026-06-02",
    tester: TECHS[0],
    type: mnT,
    equip: uvvis,
    field: 9,
    std: 2,
    source: SOURCES[3],
    unitCost: 120,
    dilutedFrac: 0,
    chemUse: {
      "Mn Standard": 5,
      H2SO4: 27.5
    }
  }), rec({
    date: "2026-07-01",
    tester: TECHS[1],
    type: mnT,
    equip: uvvis,
    field: 6,
    std: 1,
    source: SOURCES[0],
    unitCost: 120,
    dilutedFrac: 0.2,
    chemUse: {
      "Mn Standard": 5,
      H2SO4: 18.5
    }
  }),
  // Chloride (Cl) — 4 records, Titration Assembly, no dilution
  rec({
    date: "2026-05-08",
    tester: TECHS[0],
    type: clT,
    equip: titration,
    field: 10,
    std: 2,
    source: SOURCES[2],
    unitCost: 80,
    dilutedFrac: 0,
    chemUse: {
      AgNO3: 41,
      "Cl2 Standard": 6
    }
  }), rec({
    date: "2026-06-05",
    tester: TECHS[2],
    type: clT,
    equip: titration,
    field: 8,
    std: 2,
    source: SOURCES[1],
    unitCost: 80,
    dilutedFrac: 0,
    chemUse: {
      AgNO3: 33,
      "Cl2 Standard": 6
    }
  }), rec({
    date: "2026-06-25",
    tester: TECHS[1],
    type: clT,
    equip: titration,
    field: 12,
    std: 3,
    source: SOURCES[0],
    unitCost: 80,
    dilutedFrac: 0,
    chemUse: {
      AgNO3: 49,
      "Cl2 Standard": 9
    }
  }), rec({
    date: "2026-07-14",
    tester: TECHS[0],
    type: clT,
    equip: titration,
    field: 9,
    std: 2,
    source: SOURCES[3],
    unitCost: 80,
    dilutedFrac: 0,
    chemUse: {
      AgNO3: 37,
      "Cl2 Standard": 6
    }
  })];
  const masterChemicals = [...new Set([...DEFAULT_MASTER_CHEMICALS, "NaBH4", "KI", "Mn Standard", "H2SO4", "AgNO3", "Cl2 Standard"])];
  return {
    chemicals,
    equipment,
    gasList,
    testTypes,
    testRecords,
    masterChemicals
  };
}
