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

		<article v-else-if="invoice" class="isdoc-invoice">
			<!-- Document header -->
			<header class="isdoc-invoice__header">
				<h2>{{ documentTypeLabel }} {{ invoice.id }}</h2>
				<dl class="isdoc-invoice__meta">
					<template v-if="invoice.issueDate">
						<dt>{{ t('files_isdoc', 'Issue date') }}</dt>
						<dd>{{ invoice.issueDate }}</dd>
					</template>
					<template v-if="invoice.taxPointDate">
						<dt>{{ t('files_isdoc', 'Tax point date') }}</dt>
						<dd>{{ invoice.taxPointDate }}</dd>
					</template>
					<template v-if="invoice.currency">
						<dt>{{ t('files_isdoc', 'Currency') }}</dt>
						<dd>{{ invoice.currency }}</dd>
					</template>
					<template v-if="invoice.uuid">
						<dt>UUID</dt>
						<dd class="isdoc-invoice__muted">{{ invoice.uuid }}</dd>
					</template>
				</dl>
			</header>

			<!-- Parties -->
			<section class="isdoc-invoice__parties">
				<div v-if="invoice.supplier" class="isdoc-invoice__party">
					<h3>{{ t('files_isdoc', 'Supplier') }}</h3>
					<party-block :party="invoice.supplier" />
				</div>
				<div v-if="invoice.customer" class="isdoc-invoice__party">
					<h3>{{ t('files_isdoc', 'Customer') }}</h3>
					<party-block :party="invoice.customer" />
				</div>
			</section>

			<!-- Invoice lines -->
			<section v-if="invoice.lines.length">
				<h3>{{ t('files_isdoc', 'Invoice lines') }}</h3>
				<table class="isdoc-invoice__table">
					<thead>
						<tr>
							<th>#</th>
							<th>{{ t('files_isdoc', 'Description') }}</th>
							<th class="isdoc-invoice__num">{{ t('files_isdoc', 'Quantity') }}</th>
							<th class="isdoc-invoice__num">{{ t('files_isdoc', 'Unit price') }}</th>
							<th class="isdoc-invoice__num">{{ t('files_isdoc', 'VAT rate') }}</th>
							<th class="isdoc-invoice__num">{{ t('files_isdoc', 'Total excl. VAT') }}</th>
							<th class="isdoc-invoice__num">{{ t('files_isdoc', 'Total incl. VAT') }}</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="(line, index) in invoice.lines" :key="index">
							<td>{{ line.id }}</td>
							<td>{{ line.description }}</td>
							<td class="isdoc-invoice__num">{{ line.quantity }} {{ line.unitCode }}</td>
							<td class="isdoc-invoice__num">{{ line.unitPrice }}</td>
							<td class="isdoc-invoice__num">{{ line.vatRate ? line.vatRate + ' %' : '' }}</td>
							<td class="isdoc-invoice__num">{{ line.lineExtensionAmount }}</td>
							<td class="isdoc-invoice__num">{{ line.lineExtensionAmountTaxInclusive }}</td>
						</tr>
					</tbody>
				</table>
			</section>

			<!-- Tax recapitulation -->
			<section v-if="invoice.taxSubTotals.length">
				<h3>{{ t('files_isdoc', 'Tax recapitulation') }}</h3>
				<table class="isdoc-invoice__table">
					<thead>
						<tr>
							<th class="isdoc-invoice__num">{{ t('files_isdoc', 'VAT rate') }}</th>
							<th class="isdoc-invoice__num">{{ t('files_isdoc', 'Taxable amount') }}</th>
							<th class="isdoc-invoice__num">{{ t('files_isdoc', 'Tax amount') }}</th>
							<th class="isdoc-invoice__num">{{ t('files_isdoc', 'Total incl. VAT') }}</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="(sub, index) in invoice.taxSubTotals" :key="index">
							<td class="isdoc-invoice__num">{{ sub.percent ? sub.percent + ' %' : '' }}</td>
							<td class="isdoc-invoice__num">{{ sub.taxableAmount }}</td>
							<td class="isdoc-invoice__num">{{ sub.taxAmount }}</td>
							<td class="isdoc-invoice__num">{{ sub.taxInclusiveAmount }}</td>
						</tr>
					</tbody>
				</table>
			</section>

			<!-- Totals -->
			<section>
				<h3>{{ t('files_isdoc', 'Totals') }}</h3>
				<dl class="isdoc-invoice__totals">
					<template v-for="row in totalRows">
						<dt :key="'dt-' + row.label">{{ row.label }}</dt>
						<dd :key="'dd-' + row.label">{{ row.value }} {{ invoice.currency }}</dd>
					</template>
					<dt v-if="invoice.totals.payableAmount !== null" class="isdoc-invoice__payable">
						{{ t('files_isdoc', 'Amount to pay') }}
					</dt>
					<dd v-if="invoice.totals.payableAmount !== null" class="isdoc-invoice__payable">
						{{ invoice.totals.payableAmount }} {{ invoice.currency }}
					</dd>
				</dl>
			</section>

			<!-- Payment information -->
			<section v-if="invoice.payments.length">
				<h3>{{ t('files_isdoc', 'Payment information') }}</h3>
				<dl v-for="(payment, index) in invoice.payments"
					:key="index"
					class="isdoc-invoice__payment">
					<template v-if="payment.paymentMeansCode">
						<dt>{{ t('files_isdoc', 'Payment method') }}</dt>
						<dd>{{ paymentMeansLabel(payment.paymentMeansCode) }}</dd>
					</template>
					<template v-if="payment.dueDate">
						<dt>{{ t('files_isdoc', 'Due date') }}</dt>
						<dd>{{ payment.dueDate }}</dd>
					</template>
					<template v-if="payment.accountNumber">
						<dt>{{ t('files_isdoc', 'Bank account') }}</dt>
						<dd>{{ payment.accountNumber }}{{ payment.bankCode ? '/' + payment.bankCode : '' }}</dd>
					</template>
					<template v-if="payment.iban">
						<dt>IBAN</dt>
						<dd>{{ payment.iban }}</dd>
					</template>
					<template v-if="payment.bic">
						<dt>BIC</dt>
						<dd>{{ payment.bic }}</dd>
					</template>
					<template v-if="payment.variableSymbol">
						<dt>{{ t('files_isdoc', 'Variable symbol') }}</dt>
						<dd>{{ payment.variableSymbol }}</dd>
					</template>
					<template v-if="payment.constantSymbol">
						<dt>{{ t('files_isdoc', 'Constant symbol') }}</dt>
						<dd>{{ payment.constantSymbol }}</dd>
					</template>
					<template v-if="payment.specificSymbol">
						<dt>{{ t('files_isdoc', 'Specific symbol') }}</dt>
						<dd>{{ payment.specificSymbol }}</dd>
					</template>
					<template v-if="payment.paidAmount">
						<dt>{{ t('files_isdoc', 'Amount') }}</dt>
						<dd>{{ payment.paidAmount }} {{ invoice.currency }}</dd>
					</template>
				</dl>
			</section>

			<!-- Note -->
			<section v-if="invoice.note">
				<h3>{{ t('files_isdoc', 'Note') }}</h3>
				<p>{{ invoice.note }}</p>
			</section>

			<footer class="isdoc-invoice__muted">
				ISDOC {{ invoice.version }}
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
	1: t('files_isdoc', 'Invoice'),
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

const PartyBlock = {
	name: 'PartyBlock',
	props: {
		party: { type: Object, required: true },
	},
	render(h) {
		const rows = []
		const line = (content, cls) => h('div', { class: cls }, content)
		if (this.party.name) {
			rows.push(line(this.party.name, 'isdoc-invoice__party-name'))
		}
		const street = [this.party.street, this.party.buildingNumber].filter(Boolean).join(' ')
		if (street) {
			rows.push(line(street))
		}
		const city = [this.party.postalZone, this.party.city].filter(Boolean).join(' ')
		if (city) {
			rows.push(line(city))
		}
		const country = this.party.countryName ?? this.party.countryCode
		if (country) {
			rows.push(line(country))
		}
		if (this.party.ico) {
			rows.push(line(t('files_isdoc', 'Company ID') + ': ' + this.party.ico))
		}
		if (this.party.dic) {
			rows.push(line(t('files_isdoc', 'VAT ID') + ': ' + this.party.dic))
		}
		return h('div', rows)
	},
}

export default {
	name: 'IsdocView',

	components: {
		PartyBlock,
	},

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
		/** Optional totals rows, only shown when present in the document */
		totalRows() {
			const totals = this.invoice.totals
			return [
				{ label: t('files_isdoc', 'Total excl. VAT'), value: totals.taxExclusiveAmount },
				{ label: t('files_isdoc', 'Total incl. VAT'), value: totals.taxInclusiveAmount },
				{ label: t('files_isdoc', 'Already claimed (excl. VAT)'), value: totals.alreadyClaimedTaxExclusiveAmount },
				{ label: t('files_isdoc', 'Already claimed (incl. VAT)'), value: totals.alreadyClaimedTaxInclusiveAmount },
				{ label: t('files_isdoc', 'Difference (excl. VAT)'), value: totals.differenceTaxExclusiveAmount },
				{ label: t('files_isdoc', 'Difference (incl. VAT)'), value: totals.differenceTaxInclusiveAmount },
				{ label: t('files_isdoc', 'Paid deposits'), value: totals.paidDepositsAmount },
				{ label: t('files_isdoc', 'Rounding'), value: totals.payableRoundingAmount },
			].filter((row) => row.value !== null)
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

.isdoc-invoice {
	max-width: 900px;
	margin: 0 auto;
	padding: 24px;
	color: var(--color-main-text, #222);
}

.isdoc-invoice h2,
.isdoc-invoice h3 {
	margin: 16px 0 8px;
}

.isdoc-invoice__meta,
.isdoc-invoice__totals,
.isdoc-invoice__payment {
	display: grid;
	grid-template-columns: max-content 1fr;
	gap: 2px 16px;
	margin: 8px 0;
}

.isdoc-invoice__meta dt,
.isdoc-invoice__totals dt,
.isdoc-invoice__payment dt {
	font-weight: bold;
}

.isdoc-invoice__totals dd,
.isdoc-invoice__payment dd,
.isdoc-invoice__meta dd {
	margin: 0;
}

.isdoc-invoice__parties {
	display: flex;
	flex-wrap: wrap;
	gap: 24px;
	margin: 8px 0;
}

.isdoc-invoice__party {
	flex: 1 1 250px;
}

.isdoc-invoice__party-name {
	font-weight: bold;
}

.isdoc-invoice__table {
	width: 100%;
	border-collapse: collapse;
	margin: 8px 0;
}

.isdoc-invoice__table th,
.isdoc-invoice__table td {
	border: 1px solid var(--color-border, #ddd);
	padding: 4px 8px;
	text-align: left;
	vertical-align: top;
}

.isdoc-invoice__num {
	text-align: right !important;
	white-space: nowrap;
}

.isdoc-invoice__payable {
	font-size: 1.2em;
	font-weight: bold;
}

.isdoc-invoice__payment {
	border-top: 1px solid var(--color-border, #ddd);
	padding-top: 8px;
}

.isdoc-invoice__muted {
	color: var(--color-text-maxcontrast, #767676);
	font-size: 0.9em;
}
</style>
