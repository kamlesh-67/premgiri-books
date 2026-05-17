import { PrismaClient, VoucherType, VoucherStatus, DrCr, AccountNature, GstRegType } from '@prisma/client'
import { Decimal } from 'decimal.js'
import bcrypt from 'bcryptjs'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

// Load .env.local for standalone script execution
import { config } from 'dotenv'
config({ path: '.env.local' })

function createPrismaClient() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL environment variable is required')
  const pool = new Pool({ connectionString: url })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

const prisma = createPrismaClient()

async function seedCompanyMasterData(companyId: string) {
  const groups: Array<{ id: string; name: string; parentId?: string; nature: AccountNature; affectsGP: boolean }> = [
    { id: 'ag-assets',              name: 'Assets',              nature: 'ASSET',     affectsGP: false },
    { id: 'ag-liabilities',         name: 'Liabilities',         nature: 'LIABILITY', affectsGP: false },
    { id: 'ag-income',              name: 'Income',              nature: 'INCOME',    affectsGP: false },
    { id: 'ag-expense',             name: 'Expense',             nature: 'EXPENSE',   affectsGP: false },
    { id: 'ag-fixed-assets',        name: 'Fixed Assets',        parentId: 'ag-assets',              nature: 'ASSET',     affectsGP: false },
    { id: 'ag-current-assets',      name: 'Current Assets',      parentId: 'ag-assets',              nature: 'ASSET',     affectsGP: false },
    { id: 'ag-sundry-debtors',      name: 'Sundry Debtors',      parentId: 'ag-current-assets',      nature: 'ASSET',     affectsGP: false },
    { id: 'ag-bank',                name: 'Bank Accounts',       parentId: 'ag-current-assets',      nature: 'ASSET',     affectsGP: false },
    { id: 'ag-cash',                name: 'Cash-in-Hand',        parentId: 'ag-current-assets',      nature: 'ASSET',     affectsGP: false },
    { id: 'ag-stock-in-hand',       name: 'Stock-in-Hand',       parentId: 'ag-current-assets',      nature: 'ASSET',     affectsGP: true  },
    { id: 'ag-current-liabilities', name: 'Current Liabilities', parentId: 'ag-liabilities',         nature: 'LIABILITY', affectsGP: false },
    { id: 'ag-sundry-creditors',    name: 'Sundry Creditors',    parentId: 'ag-current-liabilities', nature: 'LIABILITY', affectsGP: false },
    { id: 'ag-duties-taxes',        name: 'Duties & Taxes',      parentId: 'ag-current-liabilities', nature: 'LIABILITY', affectsGP: false },
    { id: 'ag-capital',             name: 'Capital Account',     parentId: 'ag-liabilities',         nature: 'LIABILITY', affectsGP: false },
    { id: 'ag-direct-income',       name: 'Direct Income',       parentId: 'ag-income',              nature: 'INCOME',    affectsGP: true  },
    { id: 'ag-indirect-income',     name: 'Indirect Income',     parentId: 'ag-income',              nature: 'INCOME',    affectsGP: false },
    { id: 'ag-direct-expense',      name: 'Direct Expense',      parentId: 'ag-expense',             nature: 'EXPENSE',   affectsGP: true  },
    { id: 'ag-indirect-expense',    name: 'Indirect Expense',    parentId: 'ag-expense',             nature: 'EXPENSE',   affectsGP: false },
    { id: 'ag-purchase',            name: 'Purchase Accounts',   parentId: 'ag-direct-expense',      nature: 'EXPENSE',   affectsGP: true  },
  ]
  for (const g of groups) {
    await prisma.accountGroup.upsert({
      where: { companyId_name: { companyId, name: g.name } },
      update: {},
      create: {
        id: g.id + '-' + companyId,
        companyId,
        name: g.name,
        parentId: g.parentId ? g.parentId + '-' + companyId : null,
        nature: g.nature,
        affectsGP: g.affectsGP,
        isSystem: true,
      },
    })
  }
  await prisma.unitOfMeasure.upsert({
    where: { companyId_symbol: { companyId, symbol: 'PCS' } },
    update: {},
    create: { companyId, name: 'Pieces', symbol: 'PCS' },
  })
  await prisma.unitOfMeasure.upsert({
    where: { companyId_symbol: { companyId, symbol: 'KG' } },
    update: {},
    create: { companyId, name: 'Kilogram', symbol: 'KG' },
  })
  await prisma.godown.upsert({
    where: { companyId_name: { companyId, name: 'Main Godown' } },
    update: {},
    create: { companyId, name: 'Main Godown', address: '', isMain: true },
  })
}

async function main() {
  console.log('Seeding PremGiri Books demo data...')

  // --- 1. Demo Company -------------------------------------------------------
  const company = await prisma.company.upsert({
    where: { id: 'demo-company-01' },
    update: {},
    create: {
      id: 'demo-company-01',
      name: 'PremGiri Demo Co',
      gstin: '29ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      stateCode: '29', // Karnataka
      address: '123 MG Road, Bengaluru, Karnataka 560001',
      fyStart: 4, // April
      annualTurnover: new Decimal('15000000'), // Rs.1.5 Cr
    },
  })
  console.log('  Company: PremGiri Demo Co (GSTIN: 29ABCDE1234F1Z5)')

  // --- 2. Roles (D-01 resource-action format) --------------------------------
  const adminPermissions = {
    vouchers: ['read', 'write', 'admin'],
    reports:  ['read', 'write', 'admin'],
    masters:  ['read', 'write', 'admin'],
    settings: ['read', 'write', 'admin'],
    users:    ['read', 'write', 'admin'],
  }
  const accountantPermissions = {
    vouchers: ['read', 'write'],
    reports:  ['read'],
    masters:  ['read', 'write'],
    settings: [],
    users:    [],
  }
  const viewerPermissions = {
    vouchers: ['read'],
    reports:  ['read'],
    masters:  ['read'],
    settings: [],
    users:    [],
  }

  const adminRole = await prisma.role.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Admin' } },
    update: { permissions: adminPermissions },
    create: { companyId: company.id, name: 'Admin', permissions: adminPermissions },
  })
  const accountantRole = await prisma.role.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Accountant' } },
    update: { permissions: accountantPermissions },
    create: {
      companyId: company.id,
      name: 'Accountant',
      permissions: accountantPermissions,
    },
  })
  await prisma.role.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Viewer' } },
    update: { permissions: viewerPermissions },
    create: {
      companyId: company.id,
      name: 'Viewer',
      permissions: viewerPermissions,
    },
  })
  console.log('  Roles: Admin, Accountant, Viewer')

  // --- 3. Users --------------------------------------------------------------
  const passwordHash = await bcrypt.hash('demo123', 10)

  await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: 'owner@demo.com' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Ramesh Kumar',
      email: 'owner@demo.com',
      passwordHash,
      roleId: adminRole.id,
      uiMode: 'simple',
      isActive: true,
    },
  })
  await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: 'accountant@demo.com' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Arjun Mehta',
      email: 'accountant@demo.com',
      passwordHash,
      roleId: accountantRole.id,
      uiMode: 'advanced',
      isActive: true,
    },
  })
  // Find the Viewer role that was already created above
  const viewerRole = await prisma.role.findFirst({
    where: { companyId: company.id, name: 'Viewer' },
  })
  if (!viewerRole) throw new Error('Viewer role not found — seed data error')

  await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: 'viewer@demo.com' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Priya Viewer',
      email: 'viewer@demo.com',
      passwordHash: await bcrypt.hash('demo123', 10),
      roleId: viewerRole.id,
      uiMode: 'advanced',
      isActive: true,
    },
  })
  console.log('  Users: owner@demo.com (simple), accountant@demo.com (advanced) -- password: demo123')
  console.log('  Users: viewer@demo.com added (Viewer role)')

  // --- 3b. PremGiri Books production users (premgiribooks.com domain) ----------
  const prodCompany = await prisma.company.upsert({
    where: { id: 'premgiri-books-prod' },
    update: {},
    create: {
      id: 'premgiri-books-prod',
      name: 'PremGiri Books',
      gstin: '08AABCP1234A1Z5',
      pan: 'AABCP1234A',
      stateCode: '08', // Rajasthan
      address: 'PremGiri Books, Rajasthan, India',
      fyStart: 4,
      annualTurnover: new Decimal('0'),
    },
  })

  // Roles for prod company
  const prodAdminRole = await prisma.role.upsert({
    where: { companyId_name: { companyId: prodCompany.id, name: 'Admin' } },
    update: { permissions: adminPermissions },
    create: { companyId: prodCompany.id, name: 'Admin', permissions: adminPermissions },
  })
  const prodAccountantRole = await prisma.role.upsert({
    where: { companyId_name: { companyId: prodCompany.id, name: 'Accountant' } },
    update: { permissions: accountantPermissions },
    create: { companyId: prodCompany.id, name: 'Accountant', permissions: accountantPermissions },
  })
  await prisma.role.upsert({
    where: { companyId_name: { companyId: prodCompany.id, name: 'Viewer' } },
    update: { permissions: viewerPermissions },
    create: { companyId: prodCompany.id, name: 'Viewer', permissions: viewerPermissions },
  })

  const prodPasswordHash = await bcrypt.hash('Premgiri@123', 10)

  await prisma.user.upsert({
    where: { companyId_email: { companyId: prodCompany.id, email: 'subhash@premgiribooks.com' } },
    update: { roleId: prodAdminRole.id, isActive: true },
    create: {
      companyId: prodCompany.id,
      name: 'Subhash',
      email: 'subhash@premgiribooks.com',
      passwordHash: prodPasswordHash,
      roleId: prodAdminRole.id,
      uiMode: 'advanced',
      isActive: true,
    },
  })
  await prisma.user.upsert({
    where: { companyId_email: { companyId: prodCompany.id, email: 'kamlesh@premgiribooks.com' } },
    update: { roleId: prodAccountantRole.id, isActive: true },
    create: {
      companyId: prodCompany.id,
      name: 'Kamlesh',
      email: 'kamlesh@premgiribooks.com',
      passwordHash: prodPasswordHash,
      roleId: prodAccountantRole.id,
      uiMode: 'advanced',
      isActive: true,
    },
  })
  await prisma.user.upsert({
    where: { companyId_email: { companyId: prodCompany.id, email: 'renu@premgiribooks.com' } },
    update: { roleId: prodAccountantRole.id, isActive: true },
    create: {
      companyId: prodCompany.id,
      name: 'Renu',
      email: 'renu@premgiribooks.com',
      passwordHash: prodPasswordHash,
      roleId: prodAccountantRole.id,
      uiMode: 'advanced',
      isActive: true,
    },
  })

  // Seed voucher sequences for prod company
  for (const vtype of ['SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'JOURNAL', 'CONTRA', 'CREDIT_NOTE', 'DEBIT_NOTE']) {
    await prisma.voucherSequence.upsert({
      where: {
        companyId_voucherType_financialYear: {
          companyId: prodCompany.id,
          voucherType: vtype as VoucherType,
          financialYear: '2024-25',
        },
      },
      update: {},
      create: {
        companyId: prodCompany.id,
        voucherType: vtype as VoucherType,
        financialYear: '2024-25',
        lastSequence: 0,
      },
    })
  }

  console.log('  PremGiri Books prod company + 3 users seeded:')
  console.log('    subhash@premgiribooks.com  / Premgiri@123  (Owner/Admin)')
  console.log('    kamlesh@premgiribooks.com  / Premgiri@123  (Accountant)')
  console.log('    renu@premgiribooks.com     / Premgiri@123  (Accountant)')

  // Seed full chart of accounts + UoM + Godown for prod company
  await seedCompanyMasterData(prodCompany.id)
  console.log('  PremGiri Books prod: account groups, UoMs, godown seeded')

  // --- 4. Default Account Group Tree (MAST-05) — demo company ----------------
  const groups: Array<{
    id: string
    name: string
    parentId?: string
    nature: AccountNature
    affectsGP: boolean
  }> = [
    { id: 'ag-assets',              name: 'Assets',              nature: 'ASSET',     affectsGP: false },
    { id: 'ag-liabilities',         name: 'Liabilities',         nature: 'LIABILITY', affectsGP: false },
    { id: 'ag-income',              name: 'Income',              nature: 'INCOME',    affectsGP: false },
    { id: 'ag-expense',             name: 'Expense',             nature: 'EXPENSE',   affectsGP: false },
    { id: 'ag-fixed-assets',        name: 'Fixed Assets',        parentId: 'ag-assets',           nature: 'ASSET',     affectsGP: false },
    { id: 'ag-current-assets',      name: 'Current Assets',      parentId: 'ag-assets',           nature: 'ASSET',     affectsGP: false },
    { id: 'ag-sundry-debtors',      name: 'Sundry Debtors',      parentId: 'ag-current-assets',   nature: 'ASSET',     affectsGP: false },
    { id: 'ag-bank',                name: 'Bank Accounts',       parentId: 'ag-current-assets',   nature: 'ASSET',     affectsGP: false },
    { id: 'ag-cash',                name: 'Cash-in-Hand',        parentId: 'ag-current-assets',   nature: 'ASSET',     affectsGP: false },
    { id: 'ag-stock-in-hand',       name: 'Stock-in-Hand',       parentId: 'ag-current-assets',   nature: 'ASSET',     affectsGP: true  },
    { id: 'ag-current-liabilities', name: 'Current Liabilities', parentId: 'ag-liabilities',      nature: 'LIABILITY', affectsGP: false },
    { id: 'ag-sundry-creditors',    name: 'Sundry Creditors',    parentId: 'ag-current-liabilities', nature: 'LIABILITY', affectsGP: false },
    { id: 'ag-duties-taxes',        name: 'Duties & Taxes',      parentId: 'ag-current-liabilities', nature: 'LIABILITY', affectsGP: false },
    { id: 'ag-capital',             name: 'Capital Account',     parentId: 'ag-liabilities',      nature: 'LIABILITY', affectsGP: false },
    { id: 'ag-direct-income',       name: 'Direct Income',       parentId: 'ag-income',           nature: 'INCOME',    affectsGP: true  },
    { id: 'ag-indirect-income',     name: 'Indirect Income',     parentId: 'ag-income',           nature: 'INCOME',    affectsGP: false },
    { id: 'ag-direct-expense',      name: 'Direct Expense',      parentId: 'ag-expense',          nature: 'EXPENSE',   affectsGP: true  },
    { id: 'ag-indirect-expense',    name: 'Indirect Expense',    parentId: 'ag-expense',          nature: 'EXPENSE',   affectsGP: false },
    { id: 'ag-purchase',            name: 'Purchase Accounts',   parentId: 'ag-direct-expense',   nature: 'EXPENSE',   affectsGP: true  },
  ]

  for (const g of groups) {
    await prisma.accountGroup.upsert({
      where: { companyId_name: { companyId: company.id, name: g.name } },
      update: {},
      create: {
        id: g.id + '-' + company.id,
        companyId: company.id,
        name: g.name,
        parentId: g.parentId ? g.parentId + '-' + company.id : null,
        nature: g.nature,
        affectsGP: g.affectsGP,
        isSystem: true,
      },
    })
  }
  console.log(`  Account groups: ${groups.length} groups seeded (standard Indian chart of accounts)`)

  async function getGroupId(name: string): Promise<string> {
    const g = await prisma.accountGroup.findFirst({ where: { companyId: company.id, name } })
    if (!g) throw new Error(`Group not found: ${name}`)
    return g.id
  }

  // --- 5. Units of Measure ---------------------------------------------------
  const uomPcs = await prisma.unitOfMeasure.upsert({
    where: { companyId_symbol: { companyId: company.id, symbol: 'PCS' } },
    update: {},
    create: { companyId: company.id, name: 'Pieces', symbol: 'PCS' },
  })
  await prisma.unitOfMeasure.upsert({
    where: { companyId_symbol: { companyId: company.id, symbol: 'KG' } },
    update: {},
    create: { companyId: company.id, name: 'Kilogram', symbol: 'KG' },
  })
  console.log('  UoM: PCS, KG')

  // --- 6. Godown -------------------------------------------------------------
  await prisma.godown.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Main Godown' } },
    update: {},
    create: { companyId: company.id, name: 'Main Godown', address: '123 MG Road, Bengaluru', isMain: true },
  })
  console.log('  Godown: Main Godown')

  // --- 7. Sample Ledgers -----------------------------------------------------
  const salesGroupId     = await getGroupId('Direct Income')
  const purchaseGroupId  = await getGroupId('Purchase Accounts')
  const debtorsGroupId   = await getGroupId('Sundry Debtors')
  const creditorsGroupId = await getGroupId('Sundry Creditors')
  const cashGroupId      = await getGroupId('Cash-in-Hand')
  const bankGroupId      = await getGroupId('Bank Accounts')
  const dutiesGroupId    = await getGroupId('Duties & Taxes')

  const ledgers = {
    salesIncome: await prisma.ledger.upsert({
      where: { companyId_name: { companyId: company.id, name: 'Sales Income' } },
      update: {},
      create: {
        companyId: company.id,
        name: 'Sales Income',
        groupId: salesGroupId,
        drCr: DrCr.CR,
        gstRegType: GstRegType.REGULAR,
        openingBalance: new Decimal(0),
      },
    }),
    purchaseAccount: await prisma.ledger.upsert({
      where: { companyId_name: { companyId: company.id, name: 'Purchase Account' } },
      update: {},
      create: {
        companyId: company.id,
        name: 'Purchase Account',
        groupId: purchaseGroupId,
        drCr: DrCr.DR,
        openingBalance: new Decimal(0),
      },
    }),
    cash: await prisma.ledger.upsert({
      where: { companyId_name: { companyId: company.id, name: 'Cash' } },
      update: {},
      create: {
        companyId: company.id,
        name: 'Cash',
        groupId: cashGroupId,
        drCr: DrCr.DR,
        openingBalance: new Decimal('50000'),
      },
    }),
    hdfc: await prisma.ledger.upsert({
      where: { companyId_name: { companyId: company.id, name: 'HDFC Bank' } },
      update: {},
      create: {
        companyId: company.id,
        name: 'HDFC Bank',
        groupId: bankGroupId,
        drCr: DrCr.DR,
        openingBalance: new Decimal('500000'),
        bankName: 'HDFC Bank',
        bankAccount: '12345678901234',
        ifsc: 'HDFC0001234',
      },
    }),
    gstPayable: await prisma.ledger.upsert({
      where: { companyId_name: { companyId: company.id, name: 'GST Payable' } },
      update: {},
      create: {
        companyId: company.id,
        name: 'GST Payable',
        groupId: dutiesGroupId,
        drCr: DrCr.CR,
        openingBalance: new Decimal(0),
      },
    }),
    alphaTraders: await prisma.ledger.upsert({
      where: { companyId_name: { companyId: company.id, name: 'Alpha Traders' } },
      update: {},
      create: {
        companyId: company.id,
        name: 'Alpha Traders',
        groupId: debtorsGroupId,
        drCr: DrCr.DR,
        gstin: '27AAAAA1234A1Z5',
        stateCode: '27',
        gstRegType: GstRegType.REGULAR,
        openingBalance: new Decimal(0),
      },
    }),
    betaSupplies: await prisma.ledger.upsert({
      where: { companyId_name: { companyId: company.id, name: 'Beta Supplies Pvt Ltd' } },
      update: {},
      create: {
        companyId: company.id,
        name: 'Beta Supplies Pvt Ltd',
        groupId: creditorsGroupId,
        drCr: DrCr.CR,
        gstin: '29BBBBB5678B1Z5',
        stateCode: '29',
        gstRegType: GstRegType.REGULAR,
        openingBalance: new Decimal(0),
      },
    }),
  }
  console.log('  Ledgers: Sales Income, Purchase Account, Cash, HDFC Bank, GST Payable, Alpha Traders, Beta Supplies Pvt Ltd')

  // --- 8. Stock Groups + Items -----------------------------------------------
  const stockGroupGeneral = await prisma.stockGroup.upsert({
    where: { companyId_name: { companyId: company.id, name: 'General' } },
    update: {},
    create: { companyId: company.id, name: 'General' },
  })

  await prisma.stockItem.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Laptop 15"' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Laptop 15"',
      groupId: stockGroupGeneral.id,
      uomId: uomPcs.id,
      hsnCode: '84713020',
      gstRate: new Decimal('18'),
      openingQty: new Decimal('10'),
      openingRate: new Decimal('55000'),
    },
  })
  await prisma.stockItem.upsert({
    where: { companyId_name: { companyId: company.id, name: 'USB-C Cable' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'USB-C Cable',
      groupId: stockGroupGeneral.id,
      uomId: uomPcs.id,
      hsnCode: '85444299',
      gstRate: new Decimal('18'),
      openingQty: new Decimal('100'),
      openingRate: new Decimal('250'),
    },
  })
  console.log('  Stock items: Laptop 15", USB-C Cable (HSN codes, 18% GST)')

  // --- 9. Voucher Sequences --------------------------------------------------
  const fy = '2024-25'
  for (const vtype of [
    'SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT',
    'JOURNAL', 'CONTRA', 'CREDIT_NOTE', 'DEBIT_NOTE',
  ]) {
    await prisma.voucherSequence.upsert({
      where: {
        companyId_voucherType_financialYear: {
          companyId: company.id,
          voucherType: vtype as VoucherType,
          financialYear: fy,
        },
      },
      update: {},
      create: {
        companyId: company.id,
        voucherType: vtype as VoucherType,
        financialYear: fy,
        lastSequence: 0,
      },
    })
  }
  console.log('  Voucher sequences: all 8 types initialized for FY 2024-25')

  // --- 10. Demo Vouchers -----------------------------------------------------
  // Sales Invoice SI-2024-25-0001
  // Inter-state sale to Alpha Traders (Maharashtra state code 27 vs Karnataka 29)
  // DR Alpha Traders 118000, CR Sales Income 100000, CR GST Payable 18000 (IGST)
  const salesVoucher = await prisma.voucher.upsert({
    where: {
      companyId_voucherType_voucherNo: {
        companyId: company.id,
        voucherType: VoucherType.SALES,
        voucherNo: 'SI-2024-25-0001',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      voucherType: VoucherType.SALES,
      voucherNo: 'SI-2024-25-0001',
      date: new Date('2024-04-15'),
      narration: 'Sale of laptops to Alpha Traders',
      partyLedgerId: ledgers.alphaTraders.id,
      totalAmount: new Decimal('118000'),
      cgstAmount: new Decimal('0'),
      sgstAmount: new Decimal('0'),
      igstAmount: new Decimal('18000'),
      status: VoucherStatus.POSTED,
      createdBy: 'seed',
    },
  })

  await prisma.voucherEntry.createMany({
    data: [
      { voucherId: salesVoucher.id, ledgerId: ledgers.alphaTraders.id,  amount: new Decimal('118000'), drCr: DrCr.DR },
      { voucherId: salesVoucher.id, ledgerId: ledgers.salesIncome.id,   amount: new Decimal('100000'), drCr: DrCr.CR },
      { voucherId: salesVoucher.id, ledgerId: ledgers.gstPayable.id,    amount: new Decimal('18000'),  drCr: DrCr.CR, narration: 'IGST' },
    ],
    skipDuplicates: true,
  })

  // Purchase Invoice PI-2024-25-0001
  // Intra-state purchase from Beta Supplies (both Karnataka 29)
  // DR Purchase Account 25000, DR GST Payable 2250 (CGST input), DR GST Payable 2250 (SGST input), CR Beta Supplies 29500
  const purchaseVoucher = await prisma.voucher.upsert({
    where: {
      companyId_voucherType_voucherNo: {
        companyId: company.id,
        voucherType: VoucherType.PURCHASE,
        voucherNo: 'PI-2024-25-0001',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      voucherType: VoucherType.PURCHASE,
      voucherNo: 'PI-2024-25-0001',
      date: new Date('2024-04-10'),
      narration: 'Purchase of USB-C Cables from Beta Supplies',
      partyLedgerId: ledgers.betaSupplies.id,
      totalAmount: new Decimal('29500'),
      cgstAmount: new Decimal('2250'),
      sgstAmount: new Decimal('2250'),
      igstAmount: new Decimal('0'),
      status: VoucherStatus.POSTED,
      createdBy: 'seed',
    },
  })

  await prisma.voucherEntry.createMany({
    data: [
      { voucherId: purchaseVoucher.id, ledgerId: ledgers.purchaseAccount.id, amount: new Decimal('25000'), drCr: DrCr.DR },
      { voucherId: purchaseVoucher.id, ledgerId: ledgers.gstPayable.id,      amount: new Decimal('2250'),  drCr: DrCr.DR, narration: 'CGST Input' },
      { voucherId: purchaseVoucher.id, ledgerId: ledgers.gstPayable.id,      amount: new Decimal('2250'),  drCr: DrCr.DR, narration: 'SGST Input' },
      { voucherId: purchaseVoucher.id, ledgerId: ledgers.betaSupplies.id,    amount: new Decimal('29500'), drCr: DrCr.CR },
    ],
    skipDuplicates: true,
  })

  // Update voucher sequences to reflect seeded vouchers
  await prisma.voucherSequence.update({
    where: { companyId_voucherType_financialYear: { companyId: company.id, voucherType: 'SALES', financialYear: fy } },
    data: { lastSequence: 1 },
  })
  await prisma.voucherSequence.update({
    where: { companyId_voucherType_financialYear: { companyId: company.id, voucherType: 'PURCHASE', financialYear: fy } },
    data: { lastSequence: 1 },
  })

  console.log('  Demo vouchers: SI-2024-25-0001 (Sales, IGST Rs.18,000), PI-2024-25-0001 (Purchase, CGST+SGST Rs.4,500)')

  // --- 11. Payroll System Ledgers (Phase 6) ------------------------------------
  const indirectExpenseGroupId = await getGroupId('Indirect Expense')
  const currentLiabGroupId = await getGroupId('Current Liabilities')

  await prisma.ledger.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Salary Expense' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Salary Expense',
      groupId: indirectExpenseGroupId,
      drCr: DrCr.DR,
      openingBalance: new Decimal('0'),
      isActive: true,
    },
  })

  await prisma.ledger.upsert({
    where: { companyId_name: { companyId: company.id, name: 'PF Payable' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'PF Payable',
      groupId: currentLiabGroupId,
      drCr: DrCr.CR,
      openingBalance: new Decimal('0'),
      isActive: true,
    },
  })

  await prisma.ledger.upsert({
    where: { companyId_name: { companyId: company.id, name: 'ESI Payable' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'ESI Payable',
      groupId: currentLiabGroupId,
      drCr: DrCr.CR,
      openingBalance: new Decimal('0'),
      isActive: true,
    },
  })

  await prisma.ledger.upsert({
    where: { companyId_name: { companyId: company.id, name: 'PT Payable' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'PT Payable',
      groupId: currentLiabGroupId,
      drCr: DrCr.CR,
      openingBalance: new Decimal('0'),
      isActive: true,
    },
  })
  console.log('  Payroll ledgers: Salary Expense (Indirect Expense), PF Payable, ESI Payable, PT Payable (Current Liabilities)')

  // --- 12. Seed Employee + Salary Structure for E2E tests ---------------------
  const salaryStructure = await prisma.salaryStructure.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Standard Engineer Structure' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Standard Engineer Structure',
      components: {
        basic: 30000,
        hra: 15000,
        otherAllowances: 5000,
        pfDeduction: 3600,
        totalGross: 50000,
        totalNet: 46400,
      },
      isActive: true,
    },
  })

  await prisma.employee.upsert({
    where: { companyId_employeeCode: { companyId: company.id, employeeCode: 'EMP001' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Ramesh Kumar',
      employeeCode: 'EMP001',
      designation: 'Software Engineer',
      department: 'Engineering',
      joinDate: new Date('2024-04-01'),
      isActive: true,
      salaryStructureId: salaryStructure.id,
      structureEffectiveFrom: new Date('2024-04-01'),
      pfApplicable: true,
      esiApplicable: false,
    },
  })
  console.log('  E2E seed: 1 employee (Ramesh Kumar / EMP001) + salary structure')

  console.log('\nSeed complete! Login with:')
  console.log('  owner@demo.com      / demo123  (Simple Mode)')
  console.log('  accountant@demo.com / demo123  (Advanced Mode)')
  console.log('  viewer@demo.com     / demo123  (Viewer role)')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
