<!--
  - SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<template>
	<div class="isdoc-viewer">
		<div v-if="error" class="isdoc-viewer__error">
			<h2>{{ t('files_isdoc', 'Could not load the invoice') }}</h2>
			<p>{{ error }}</p>
		</div>

		<article v-else-if="invoice" class="isdoc-paper">
			<!-- Title bar: supplier name left, document title right -->
			<div class="isdoc-titlebar">
				<span class="isdoc-titlebar__supplier">{{ invoice.supplier ? invoice.supplier.name : '' }}</span>
				<span class="isdoc-titlebar__title">
					{{ documentTypeLabel }} {{ t('files_isdoc', 'no.') }} {{ invoice.id }}
				</span>
			</div>

			<!-- Header grid -->
			<div class="isdoc-grid">
				<!-- Left column -->
				<div class="isdoc-grid__col">
					<section v-if="invoice.supplier" class="isdoc-box">
						<div class="isdoc-label">{{ t('files_isdoc', 'Supplier') }}:</div>
						<div class="isdoc-party__name">{{ invoice.supplier.name }}</div>
						<div v-for="(line, i) in addressLines(invoice.supplier)" :key="'s' + i">{{ line }}</div>
						<div class="isdoc-party__ids">
							<span v-if="invoice.supplier.ico">{{ t('files_isdoc', 'Company ID') }}: {{ invoice.supplier.ico }}</span>
							<span v-if="invoice.supplier.dic">{{ t('files_isdoc', 'VAT ID') }}: {{ invoice.supplier.dic }}</span>
						</div>
						<div v-if="invoice.supplier.telephone">{{ t('files_isdoc', 'Phone') }}: {{ invoice.supplier.telephone }}</div>
						<div v-if="invoice.supplier.email">{{ t('files_isdoc', 'Email') }}: {{ invoice.supplier.email }}</div>
					</section>

					<section v-if="bankPayment" class="isdoc-box">
						<table class="isdoc-kv">
							<tr v-if="bankPayment.bankName">
								<th>{{ t('files_isdoc', 'Bank') }}:</th>
								<td>{{ bankPayment.bankName }}</td>
							</tr>
							<tr v-if="bankPayment.bic">
								<th>SWIFT:</th>
								<td>{{ bankPayment.bic }}</td>
							</tr>
							<tr v-if="bankPayment.iban">
								<th>IBAN:</th>
								<td>{{ bankPayment.iban }}</td>
							</tr>
							<tr v-if="bankPayment.accountNumber">
								<th>{{ t('files_isdoc', 'Account number') }}:</th>
								<td>
									{{ bankPayment.accountNumber }}
									<template v-if="bankPayment.bankCode">
										&nbsp;&nbsp;{{ t('files_isdoc', 'Bank code') }}: {{ bankPayment.bankCode }}
									</template>
								</td>
							</tr>
						</table>
					</section>

					<section class="isdoc-box">
						<table class="isdoc-kv">
							<tr v-if="invoice.issueDate">
								<th>{{ t('files_isdoc', 'Issue date') }}:</th>
								<td class="isdoc-kv__value-box">{{ invoice.issueDate }}</td>
							</tr>
							<tr v-if="primaryPayment && primaryPayment.dueDate">
								<th>{{ t('files_isdoc', 'Due date') }}:</th>
								<td class="isdoc-kv__value-box">{{ primaryPayment.dueDate }}</td>
							</tr>
							<tr v-if="invoice.taxPointDate">
								<th>{{ t('files_isdoc', 'Tax point date') }}:</th>
								<td class="isdoc-kv__value-box">{{ invoice.taxPointDate }}</td>
							</tr>
							<tr v-if="primaryPayment && primaryPayment.paymentMeansCode">
								<th>{{ t('files_isdoc', 'Payment method') }}:</th>
								<td>{{ paymentMeansLabel(primaryPayment.paymentMeansCode) }}</td>
							</tr>
							<tr v-if="invoice.currency">
								<th>{{ t('files_isdoc', 'Currency') }}:</th>
								<td>{{ invoice.currency }}</td>
							</tr>
							<tr v-if="invoice.foreignCurrency">
								<th>{{ t('files_isdoc', 'Foreign currency') }}:</th>
								<td>
									{{ invoice.foreignCurrency }}
									<template v-if="invoice.currRate">
										({{ t('files_isdoc', 'Exchange rate') }}: {{ invoice.currRate }})
									</template>
								</td>
							</tr>
						</table>
					</section>
				</div>

				<!-- Right column -->
				<div class="isdoc-grid__col">
					<section class="isdoc-box">
						<table class="isdoc-kv">
							<tr v-if="primaryPayment && primaryPayment.variableSymbol">
								<th>{{ t('files_isdoc', 'Variable symbol') }}:</th>
								<td class="isdoc-kv__num">{{ primaryPayment.variableSymbol }}</td>
							</tr>
							<tr v-if="primaryPayment && primaryPayment.constantSymbol">
								<th>{{ t('files_isdoc', 'Constant symbol') }}:</th>
								<td class="isdoc-kv__num">{{ primaryPayment.constantSymbol }}</td>
							</tr>
							<tr v-if="primaryPayment && primaryPayment.specificSymbol">
								<th>{{ t('files_isdoc', 'Specific symbol') }}:</th>
								<td class="isdoc-kv__num">{{ primaryPayment.specificSymbol }}</td>
							</tr>
							<tr v-for="(order, i) in invoice.orderReferences" :key="'o' + i">
								<th>{{ t('files_isdoc', 'Order no.') }}:</th>
								<td class="isdoc-kv__num">
									{{ order.salesOrderID || order.externalOrderID }}
									<template v-if="order.issueDate">&nbsp;{{ t('files_isdoc', 'dated') }} {{ order.issueDate }}</template>
								</td>
							</tr>
							<tr v-for="(note, i) in invoice.deliveryNoteReferences" :key="'d' + i">
								<th>{{ t('files_isdoc', 'Delivery note') }}:</th>
								<td class="isdoc-kv__num">
									{{ note.id }}
									<template v-if="note.issueDate">&nbsp;{{ t('files_isdoc', 'dated') }} {{ note.issueDate }}</template>
								</td>
							</tr>
							<tr v-for="(ref, i) in invoice.originalDocumentReferences" :key="'r' + i">
								<th>{{ t('files_isdoc', 'Original document') }}:</th>
								<td class="isdoc-kv__num">
									{{ ref.id }}
									<template v-if="ref.issueDate">&nbsp;{{ t('files_isdoc', 'dated') }} {{ ref.issueDate }}</template>
								</td>
							</tr>
						</table>
					</section>

					<section v-if="invoice.customer" class="isdoc-box isdoc-box--customer">
						<div class="isdoc-box--customer__head">
							<span class="isdoc-label">{{ t('files_isdoc', 'Customer') }}:</span>
							<table class="isdoc-kv isdoc-kv--ids">
								<tr v-if="invoice.customer.ico">
									<th>{{ t('files_isdoc', 'Company ID') }}:</th>
									<td class="isdoc-kv__num">{{ invoice.customer.ico }}</td>
								</tr>
								<tr v-if="invoice.customer.dic">
									<th>{{ t('files_isdoc', 'VAT ID') }}:</th>
									<td class="isdoc-kv__num">{{ invoice.customer.dic }}</td>
								</tr>
							</table>
						</div>
						<div class="isdoc-box--customer__address">
							<div class="isdoc-party__name">{{ invoice.customer.name }}</div>
							<div v-for="(line, i) in addressLines(invoice.customer)" :key="'c' + i">{{ line }}</div>
						</div>
					</section>
				</div>
			</div>

			<!-- Document note (Pohoda prints it as an intro line above the items) -->
			<p v-if="invoice.note" class="isdoc-note">{{ invoice.note }}</p>

			<!-- Invoice lines -->
			<table v-if="invoice.lines.length" class="isdoc-lines">
				<thead>
					<tr>
						<th>{{ t('files_isdoc', 'Description') }}</th>
						<th class="isdoc-num">{{ t('files_isdoc', 'Quantity') }}</th>
						<th class="isdoc-num">{{ t('files_isdoc', 'Unit price') }}</th>
						<th class="isdoc-num">{{ t('files_isdoc', 'Net amount') }}</th>
						<th class="isdoc-num">{{ t('files_isdoc', 'VAT %') }}</th>
						<th class="isdoc-num">{{ t('files_isdoc', 'VAT') }}</th>
						<th class="isdoc-num">{{ t('files_isdoc', 'Total') }}</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="(line, index) in invoice.lines" :key="index">
						<td>{{ line.description }}</td>
						<td class="isdoc-num">{{ line.quantity }} {{ line.unitCode }}</td>
						<td class="isdoc-num">{{ line.unitPrice }}</td>
						<td class="isdoc-num">{{ line.lineExtensionAmount }}</td>
						<td class="isdoc-num">{{ line.vatRate ? line.vatRate + ' %' : '' }}</td>
						<td class="isdoc-num">{{ line.lineExtensionTaxAmount }}</td>
						<td class="isdoc-num">{{ line.lineExtensionAmountTaxInclusive }}</td>
					</tr>
				</tbody>
				<tfoot>
					<tr class="isdoc-lines__subtotal">
						<td colspan="3">{{ t('files_isdoc', 'Item subtotal') }}</td>
						<td class="isdoc-num">{{ invoice.totals.taxExclusiveAmount }}</td>
						<td></td>
						<td class="isdoc-num">{{ invoice.taxTotalAmount }}</td>
						<td class="isdoc-num">{{ invoice.totals.taxInclusiveAmount }}</td>
					</tr>
					<tr v-if="invoice.totals.payableAmount !== null" class="isdoc-lines__payable">
						<td colspan="6">{{ t('files_isdoc', 'Amount to pay') }}</td>
						<td class="isdoc-num">{{ invoice.totals.payableAmount }} {{ invoice.currency }}</td>
					</tr>
				</tfoot>
			</table>

			<!-- Additional payments (when the document defines more than one) -->
			<section v-if="invoice.payments.length > 1">
				<h3 class="isdoc-label">{{ t('files_isdoc', 'Payment information') }}:</h3>
				<table class="isdoc-lines">
					<thead>
						<tr>
							<th>{{ t('files_isdoc', 'Payment method') }}</th>
							<th>{{ t('files_isdoc', 'Due date') }}</th>
							<th>{{ t('files_isdoc', 'Bank account') }}</th>
							<th>{{ t('files_isdoc', 'Variable symbol') }}</th>
							<th class="isdoc-num">{{ t('files_isdoc', 'Amount') }}</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="(payment, index) in invoice.payments" :key="index">
							<td>{{ paymentMeansLabel(payment.paymentMeansCode) }}</td>
							<td>{{ payment.dueDate }}</td>
							<td>
								{{ payment.accountNumber }}<template v-if="payment.bankCode">/{{ payment.bankCode }}</template>
								<template v-if="!payment.accountNumber && payment.iban">{{ payment.iban }}</template>
							</td>
							<td>{{ payment.variableSymbol }}</td>
							<td class="isdoc-num">{{ payment.paidAmount }} {{ invoice.currency }}</td>
						</tr>
					</tbody>
				</table>
			</section>

			<!-- Bottom: VAT recapitulation + additional totals -->
			<div class="isdoc-bottom">
				<section v-if="invoice.taxSubTotals.length" class="isdoc-bottom__recap">
					<div class="isdoc-label">{{ t('files_isdoc', 'Tax recapitulation') }}:</div>
					<table class="isdoc-recap">
						<thead>
							<tr>
								<th class="isdoc-num">{{ t('files_isdoc', 'Taxable amount') }}</th>
								<th class="isdoc-num">{{ t('files_isdoc', 'VAT rate') }}</th>
								<th class="isdoc-num">{{ t('files_isdoc', 'Tax amount') }}</th>
								<th class="isdoc-num">{{ t('files_isdoc', 'Total incl. VAT') }}</th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="(sub, index) in invoice.taxSubTotals" :key="index">
								<td class="isdoc-num">{{ sub.taxableAmount }}</td>
								<td class="isdoc-num">{{ sub.percent ? sub.percent + ' %' : '' }}</td>
								<td class="isdoc-num">{{ sub.taxAmount }}</td>
								<td class="isdoc-num">{{ sub.taxInclusiveAmount }}</td>
							</tr>
						</tbody>
					</table>
				</section>

				<section v-if="totalRows.length" class="isdoc-bottom__totals">
					<table class="isdoc-kv">
						<tr v-for="row in totalRows" :key="row.label">
							<th>{{ row.label }}:</th>
							<td class="isdoc-num">{{ row.value }} {{ invoice.currency }}</td>
						</tr>
					</table>
				</section>
			</div>

			<!-- Commercial register entry -->
			<p v-if="registerEntry" class="isdoc-muted">
				{{ t('files_isdoc', 'Registration') }}: {{ registerEntry }}
			</p>

			<footer class="isdoc-muted">
				ISDOC {{ invoice.version }}<template v-if="invoice.uuid"> · UUID {{ invoice.uuid }}</template>
			</footer>
		</article>
	</div>
</template>

<script>
import axios from '@nextcloud/axios'
import { translate as t } from '@nextcloud/l10n'

import { extractIsdocXml } from '../services/loadIsdoc.js'
import { parseIsdoc } from '../services/parseIsdoc.js'

/** ISDOC DocumentType code => label (see the ISDOC specification) */
const DOCUMENT_TYPE_LABELS = {
	1: t('files_isdoc', 'Invoice — tax document'),
	2: t('files_isdoc', 'Credit note'),
	3: t('files_isdoc', 'Debit note'),
	4: t('files_isdoc', 'Proforma invoice'),
	5: t('files_isdoc', 'Advance invoice (tax document)'),
	6: t('files_isdoc', 'Credit note for advance invoice'),
	7: t('files_isdoc', 'Simplified tax document'),
}

/** ISDOC PaymentMeansCode => label */
const PAYMENT_MEANS_LABELS = {
	10: t('files_isdoc', 'Cash'),
	20: t('files_isdoc', 'Cheque'),
	31: t('files_isdoc', 'Bank transfer'),
	42: t('files_isdoc', 'Bank transfer'),
	48: t('files_isdoc', 'Bank card'),
	97: t('files_isdoc', 'Clearing between partners'),
}

export default {
	name: 'IsdocView',

	inheritAttrs: false,

	props: {
		filename: {
			type: String,
			required: true,
		},
		basename: {
			type: String,
			default: '',
		},
		source: {
			type: String,
			default: '',
		},
		mime: {
			type: String,
			default: '',
		},
		active: {
			type: Boolean,
			default: false,
		},
	},

	data() {
		return {
			invoice: null,
			error: null,
		}
	},

	computed: {
		documentTypeLabel() {
			return DOCUMENT_TYPE_LABELS[this.invoice.documentType]
				?? t('files_isdoc', 'Document type {type}', { type: this.invoice.documentType ?? '?' })
		},
		/** First payment carrying bank details — shown in the bank box */
		bankPayment() {
			return this.invoice.payments.find((p) => p.accountNumber || p.iban) ?? null
		},
		/** Payment used for symbols, due date and payment method */
		primaryPayment() {
			return this.bankPayment ?? this.invoice.payments[0] ?? null
		},
		/** Optional totals rows, only shown when present in the document */
		totalRows() {
			const totals = this.invoice.totals
			return [
				{ label: t('files_isdoc', 'Already claimed (excl. VAT)'), value: totals.alreadyClaimedTaxExclusiveAmount },
				{ label: t('files_isdoc', 'Already claimed (incl. VAT)'), value: totals.alreadyClaimedTaxInclusiveAmount },
				{ label: t('files_isdoc', 'Difference (excl. VAT)'), value: totals.differenceTaxExclusiveAmount },
				{ label: t('files_isdoc', 'Difference (incl. VAT)'), value: totals.differenceTaxInclusiveAmount },
				{ label: t('files_isdoc', 'Paid deposits'), value: totals.paidDepositsAmount },
				{ label: t('files_isdoc', 'Rounding'), value: totals.payableRoundingAmount },
			].filter((row) => row.value !== null)
		},
		registerEntry() {
			const supplier = this.invoice.supplier
			if (!supplier) {
				return null
			}
			return [supplier.registerKeptAt, supplier.registerFileRef].filter(Boolean).join(', ') || null
		},
	},

	async mounted() {
		try {
			const response = await axios.get(this.source, { responseType: 'arraybuffer' })
			const xml = extractIsdocXml(new Uint8Array(response.data))
			this.invoice = parseIsdoc(xml)
			this.$emit('update:loaded', true)
		} catch (e) {
			console.error('files_isdoc: failed to render invoice', e)
			this.error = e.message
			this.$emit('error', e)
			// Show our own error view instead of the generic viewer one
			this.$emit('update:loaded', true)
		}
	},

	methods: {
		t,
		paymentMeansLabel(code) {
			return PAYMENT_MEANS_LABELS[code] ?? code
		},
		/** Postal address as displayable lines (street, city, country) */
		addressLines(party) {
			return [
				[party.street, party.buildingNumber].filter(Boolean).join(' '),
				[party.postalZone, party.city].filter(Boolean).join(' '),
				party.countryName ?? party.countryCode,
			].filter(Boolean)
		},
	},
}
</script>

<style scoped lang="css">
.isdoc-viewer {
	width: 100%;
	height: 100%;
	overflow-y: auto;
	background-color: var(--color-main-background, #fff);
}

.isdoc-viewer__error {
	max-width: 600px;
	margin: 10vh auto;
	text-align: center;
}

/* The invoice is rendered as a white "paper" sheet, like a PDF page */
.isdoc-paper {
	max-width: 950px;
	margin: 24px auto;
	padding: 32px 40px;
	background-color: #fff;
	color: #222;
	box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
	font-size: 14px;
	line-height: 1.45;
}

.isdoc-titlebar {
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	gap: 16px;
	flex-wrap: wrap;
	border-bottom: 2px solid #222;
	padding-bottom: 4px;
	margin-bottom: 12px;
}

.isdoc-titlebar__supplier {
	font-weight: bold;
	font-size: 16px;
}

.isdoc-titlebar__title {
	font-weight: bold;
	font-size: 16px;
	text-transform: uppercase;
	color: #15518f;
}

.isdoc-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 8px;
	margin-bottom: 12px;
}

@media (max-width: 700px) {
	.isdoc-grid {
		grid-template-columns: 1fr;
	}
}

.isdoc-grid__col {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.isdoc-box {
	border: 1px solid #999;
	border-radius: 2px;
	padding: 8px 12px;
	flex: 0 0 auto;
}

.isdoc-box--customer {
	flex: 1 1 auto;
}

.isdoc-box--customer__head {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 16px;
}

.isdoc-box--customer__address {
	margin: 8px 0 4px 16px;
	font-size: 15px;
}

.isdoc-label {
	color: #15518f;
	font-weight: bold;
	margin-bottom: 4px;
}

h3.isdoc-label {
	font-size: 14px;
	margin: 16px 0 4px;
}

.isdoc-party__name {
	font-weight: bold;
	font-size: 15px;
}

.isdoc-party__ids {
	margin-top: 6px;
	display: flex;
	gap: 16px;
	flex-wrap: wrap;
}

/* Key/value tables inside boxes */
.isdoc-kv {
	border-collapse: collapse;
	width: 100%;
}

.isdoc-kv th {
	text-align: left;
	font-weight: normal;
	padding: 1px 12px 1px 0;
	white-space: nowrap;
	width: 1%;
}

.isdoc-kv td {
	padding: 1px 0;
}

.isdoc-kv__num {
	text-align: right;
	white-space: nowrap;
}

.isdoc-kv__value-box {
	border: 1px solid #999;
	padding: 1px 8px;
	text-align: right;
	white-space: nowrap;
}

.isdoc-kv--ids th {
	padding-right: 8px;
}

.isdoc-note {
	color: #15518f;
	margin: 8px 0;
}

/* Invoice lines table */
.isdoc-lines {
	width: 100%;
	border-collapse: collapse;
	margin: 8px 0 12px;
}

.isdoc-lines th {
	border-top: 2px solid #222;
	border-bottom: 1px solid #222;
	padding: 4px 8px;
	text-align: left;
	font-weight: normal;
	white-space: nowrap;
}

.isdoc-lines td {
	padding: 4px 8px;
	vertical-align: top;
}

.isdoc-lines tbody tr:first-child td {
	padding-top: 8px;
}

.isdoc-lines tfoot td {
	border-top: 1px solid #222;
	padding: 4px 8px;
}

.isdoc-lines__subtotal td {
	font-weight: normal;
}

.isdoc-lines__payable td {
	font-weight: bold;
	font-size: 15px;
	text-transform: uppercase;
	border-top: 1px solid #222;
	border-bottom: 2px solid #222;
}

.isdoc-num {
	text-align: right !important;
	white-space: nowrap;
}

/* Bottom area: VAT recapitulation and additional totals */
.isdoc-bottom {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 24px;
	flex-wrap: wrap;
	margin: 16px 0;
}

.isdoc-recap {
	border-collapse: collapse;
}

.isdoc-recap th {
	font-weight: normal;
	padding: 2px 12px;
	border-bottom: 1px solid #999;
	white-space: nowrap;
}

.isdoc-recap td {
	padding: 2px 12px;
}

.isdoc-bottom__totals {
	margin-left: auto;
}

.isdoc-muted {
	color: #767676;
	font-size: 12px;
	margin: 12px 0 0;
}
</style>
