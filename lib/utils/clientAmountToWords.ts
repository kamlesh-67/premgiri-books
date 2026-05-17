const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const tensWords = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigit(n: number): string {
  if (n < 20) return ones[n]
  return tensWords[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
}

function threeDigit(n: number): string {
  if (n === 0) return ''
  if (n < 100) return twoDigit(n)
  return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigit(n % 100) : '')
}

export function clientAmountToWords(amount: number): string {
  if (!isFinite(amount) || amount === 0) return 'Zero Rupees Only'

  const abs = Math.abs(amount)
  const rupees = Math.floor(abs)
  const paise = Math.round((abs - rupees) * 100)

  let result = ''

  if (rupees > 0) {
    const crore = Math.floor(rupees / 10000000)
    const lakh = Math.floor((rupees % 10000000) / 100000)
    const thousand = Math.floor((rupees % 100000) / 1000)
    const remainder = rupees % 1000

    if (crore > 0) result += threeDigit(crore) + ' Crore '
    if (lakh > 0) result += threeDigit(lakh) + ' Lakh '
    if (thousand > 0) result += threeDigit(thousand) + ' Thousand '
    if (remainder > 0) result += threeDigit(remainder) + ' '

    result = result.trim() + ' Rupees'
  }

  if (paise > 0) {
    result += (rupees > 0 ? ' and ' : '') + twoDigit(paise) + ' Paise'
  }

  return (amount < 0 ? 'Minus ' : '') + result + ' Only'
}
