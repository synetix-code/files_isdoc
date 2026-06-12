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

		<template v-else-if="invoice">
			<!-- Validation banners, like the official ISDOC Reader -->
			<div class="isdoc-banners">
				<div v-if="structureProblems.length" class="isdoc-banner isdoc-banner--warn">
					<p v-for="(problem, i) in structureProblems" :key="i">⚠ {{ problem }}</p>
				</div>
				<div v-else class="isdoc-banner isdoc-banner--ok">
					<p>
						✓ {{ t('files_isdoc', 'The document structure matches the ISDOC format.') }}
						<template v-if="structureResult.isLegacyNamespace">
							({{ t('files_isdoc', 'older ISDOC format version') }})
						</template>
					</p>
				</div>

				<div v-if="failedSumChecks.length" class="isdoc-banner isdoc-banner--warn">
					<p>⚠ {{ t('files_isdoc', 'Control sums do not match:') }}</p>
					<ul>
						<li v-for="check in failedSumChecks" :key="check.key">
							{{ checkLabel(check.key) }} — {{ t('files_isdoc', 'declared {declared}, computed {computed}', {
								declared: check.declared, computed: check.computed,
							}) }}
						</li>
					</ul>
				</div>
				<div v-else-if="sumChecks.length" class="isdoc-banner isdoc-banner--ok">
					<p>✓ {{ t('files_isdoc', 'Control sums match.') }}</p>
				</div>

				<div v-if="attachmentItems.length" class="isdoc-banner isdoc-banner--info">
					<details>
						<summary>📎 {{ t('files_isdoc', 'Attachments ({count})', { count: attachmentItems.length }) }}</summary>
						<ul class="isdoc-attachments">
							<li v-for="item in attachmentItems" :key="item.key">
								<span class="isdoc-attachments__name">{{ item.displayName }}</span>
								<span v-if="item.supplement && item.supplement.isPreview" class="isdoc-attachments__badge">
									{{ t('files_isdoc', 'supplied invoice preview') }}
								</span>
								<span v-if="item.data" class="isdoc-attachments__size">{{ formatSize(item.data.length) }}</span>
								<span v-if="digestResults[item.key] === true"
									class="isdoc-mark isdoc-mark--ok"
									:title="t('files_isdoc', 'Attachment integrity verified (digest matches)')">✓</span>
								<span v-else-if="digestResults[item.key] === false"
									class="isdoc-mark isdoc-mark--warn"
									:title="t('files_isdoc', 'Attachment digest does not match the declared value')">⚠</span>
								<span v-if="!item.supplement" class="isdoc-attachments__size">
									({{ t('files_isdoc', 'not declared in the document') }})
								</span>
								<template v-if="item.data">
									<button class="isdoc-attachments__action" @click="downloadAttachment(item)">
										{{ t('files_isdoc', 'Download') }}
									</button>
									<button v-if="openableMime(item.displayName)"
										class="isdoc-attachments__action"
										@click="openAttachment(item)">
										{{ t('files_isdoc', 'Open') }}
									</button>
								</template>
								<span v-else class="isdoc-mark isdoc-mark--warn">
									⚠ {{ t('files_isdoc', 'The file is missing from the archive') }}
								</span>
							</li>
						</ul>
					</details>
				</div>

				<div v-if="invoice.hasSignature" class="isdoc-banner" :class="signatureBannerClass">
					<p>{{ signatureMessage }}</p>
					<details v-if="signature && signature.details">
						<summary>{{ t('files_isdoc', 'Signature details') }}</summary>
						<table class="isdoc-kv isdoc-banner__details">
							<tr v-if="signature.details.subject">
								<th>{{ t('files_isdoc', 'Signed by') }}:</th>
								<td>{{ signature.details.subject }}</td>
							</tr>
							<tr v-if="signature.details.issuer">
								<th>{{ t('files_isdoc', 'Issued by') }}:</th>
								<td>{{ signature.details.issuer }}</td>
							</tr>
							<tr v-if="signature.details.validFrom || signature.details.validTo">
								<th>{{ t('files_isdoc', 'Certificate validity') }}:</th>
								<td>{{ formatDate(signature.details.validFrom) }} – {{ formatDate(signature.details.validTo) }}</td>
							</tr>
							<tr v-if="signature.details.serialNumber">
								<th>{{ t('files_isdoc', 'Serial number') }}:</th>
								<td>{{ signature.details.serialNumber }}</td>
							</tr>
							<tr v-if="signature.details.signingTime">
								<th>{{ t('files_isdoc', 'Signing time') }}:</th>
								<td>{{ formatDate(signature.details.signingTime) }}</td>
							</tr>
							<tr v-if="signature.details.signatureAlgorithm">
								<th>{{ t('files_isdoc', 'Signature algorithm') }}:</th>
								<td>{{ signature.details.signatureAlgorithm }}</td>
							</tr>
							<tr v-if="signature.details.digestAlgorithm">
								<th>{{ t('files_isdoc', 'Digest algorithm') }}:</th>
								<td>{{ signature.details.digestAlgorithm }}</td>
							</tr>
						</table>
						<p v-if="signature.details.weakAlgorithm">
							⚠ {{ t('files_isdoc', 'The signature uses a weak algorithm (SHA-1/MD5).') }}
						</p>
					</details>
				</div>
			</div>

			<article class="isdoc-paper">
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
								<td class="isdoc-kv__value-box">{{ formatDate(invoice.issueDate) }}</td>
							</tr>
							<tr v-if="primaryPayment && primaryPayment.dueDate">
								<th>{{ t('files_isdoc', 'Due date') }}:</th>
								<td class="isdoc-kv__value-box">{{ formatDate(primaryPayment.dueDate) }}</td>
							</tr>
							<tr v-if="invoice.taxPointDate">
								<th>{{ t('files_isdoc', 'Tax point date') }}:</th>
								<td class="isdoc-kv__value-box">{{ formatDate(invoice.taxPointDate) }}</td>
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
									<template v-if="order.issueDate">&nbsp;{{ t('files_isdoc', 'dated') }} {{ formatDate(order.issueDate) }}</template>
								</td>
							</tr>
							<tr v-for="(note, i) in invoice.deliveryNoteReferences" :key="'d' + i">
								<th>{{ t('files_isdoc', 'Delivery note') }}:</th>
								<td class="isdoc-kv__num">
									{{ note.id }}
									<template v-if="note.issueDate">&nbsp;{{ t('files_isdoc', 'dated') }} {{ formatDate(note.issueDate) }}</template>
								</td>
							</tr>
							<tr v-for="(ref, i) in invoice.originalDocumentReferences" :key="'r' + i">
								<th>{{ t('files_isdoc', 'Original document') }}:</th>
								<td class="isdoc-kv__num">
									{{ ref.id }}
									<template v-if="ref.issueDate">&nbsp;{{ t('files_isdoc', 'dated') }} {{ formatDate(ref.issueDate) }}</template>
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
						<td class="isdoc-num">
							{{ invoice.totals.taxExclusiveAmount }}<check-mark :check="sumCheckByKey.linesNet" />
						</td>
						<td></td>
						<td class="isdoc-num">
							{{ invoice.taxTotalAmount }}<check-mark :check="sumCheckByKey.recapTax" />
						</td>
						<td class="isdoc-num">
							{{ invoice.totals.taxInclusiveAmount }}<check-mark :check="sumCheckByKey.linesGross" />
						</td>
					</tr>
					<tr v-if="invoice.totals.payableAmount !== null" class="isdoc-lines__payable">
						<td colspan="6">{{ t('files_isdoc', 'Amount to pay') }}</td>
						<td class="isdoc-num">
							{{ invoice.totals.payableAmount }} {{ invoice.currency }}<check-mark :check="sumCheckByKey.payable" />
						</td>
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
							<td>{{ formatDate(payment.dueDate) }}</td>
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
		</template>
	</div>
</template>

<script>
import axios from '@nextcloud/axios'
import { getCanonicalLocale, translate as t } from '@nextcloud/l10n'

import { formatSize, mergeAttachments, openableMime, verifyAttachmentDigest } from '../services/attachments.js'
import { loadIsdoc } from '../services/loadIsdoc.js'
import { parseIsdoc } from '../services/parseIsdoc.js'
import { inspectSignature } from '../services/signature.js'
import { checkStructure, checkSums } from '../services/validateIsdoc.js'

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

/** Control-sum check key => human label */
const CHECK_LABELS = {
	linesNet: t('files_isdoc', 'Sum of lines excl. VAT'),
	linesGross: t('files_isdoc', 'Sum of lines incl. VAT'),
	recapBase: t('files_isdoc', 'VAT recapitulation — taxable amount'),
	recapTax: t('files_isdoc', 'VAT recapitulation — tax'),
	recapGross: t('files_isdoc', 'VAT recapitulation — total incl. VAT'),
	payable: t('files_isdoc', 'Amount to pay'),
}

/** Green check / orange warning shown next to a validated amount */
const CheckMark = {
	name: 'CheckMark',
	props: {
		check: { type: Object, default: null },
	},
	render(h) {
		if (!this.check) {
			return null
		}
		const title = this.check.ok
			? t('files_isdoc', 'Control sum matches')
			: t('files_isdoc', 'declared {declared}, computed {computed}', {
				declared: this.check.declared, computed: this.check.computed,
			})
		return h('span', {
			class: ['isdoc-mark', this.check.ok ? 'isdoc-mark--ok' : 'isdoc-mark--warn'],
			attrs: { title },
		}, this.check.ok ? '✓' : '⚠')
	},
}

export default {
	name: 'IsdocView',

	components: {
		CheckMark,
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
			// Signature inspection result; null while pending
			signature: null,
			// Files shipped in the .isdocx container besides the invoice
			attachments: [],
			// Attachment digest results keyed by normalised filename
			digestResults: {},
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
		structureResult() {
			return checkStructure(this.invoice)
		},
		/** Structure problems as translated messages (empty = structure OK) */
		structureProblems() {
			const result = this.structureResult
			const problems = []
			if (result.unknownNamespace !== null) {
				problems.push(t('files_isdoc', 'Unknown document namespace: {ns}', { ns: result.unknownNamespace || '—' }))
			}
			if (result.missingElements.length) {
				problems.push(t('files_isdoc', 'Missing mandatory elements: {names}', { names: result.missingElements.join(', ') }))
			}
			return problems
		},
		sumChecks() {
			return checkSums(this.invoice)
		},
		sumCheckByKey() {
			return Object.fromEntries(this.sumChecks.map((check) => [check.key, check]))
		},
		failedSumChecks() {
			return this.sumChecks.filter((check) => !check.ok)
		},
		signatureBannerClass() {
			const status = this.signature?.verification.status
			if (status === 'valid') {
				return 'isdoc-banner--ok'
			}
			if (status === 'invalid') {
				return 'isdoc-banner--error'
			}
			if (status === 'error') {
				return 'isdoc-banner--warn'
			}
			return 'isdoc-banner--info'
		},
		attachmentItems() {
			return mergeAttachments(this.invoice.supplements, this.attachments)
		},
		signatureMessage() {
			if (!this.signature) {
				return '… ' + t('files_isdoc', 'Verifying the signature…')
			}
			const { status, reason } = this.signature.verification
			if (status === 'valid') {
				return '✓ ' + t('files_isdoc', 'The signature is cryptographically valid — document integrity verified. Certificate trust was not verified.')
			}
			if (status === 'invalid') {
				return '✗ ' + t('files_isdoc', 'The signature is INVALID — the document was modified after signing or the signature is corrupted.')
			}
			return '⚠ ' + t('files_isdoc', 'The signature could not be verified: {reason}', { reason: reason ?? '?' })
		},
	},

	async mounted() {
		try {
			const response = await axios.get(this.source, { responseType: 'arraybuffer' })
			const { xml, attachments } = loadIsdoc(new Uint8Array(response.data))
			this.invoice = parseIsdoc(xml)
			this.attachments = attachments
			this.$emit('update:loaded', true)
			if (this.invoice.hasSignature) {
				// Runs after render — crypto libraries are loaded lazily
				inspectSignature(xml).then((result) => {
					this.signature = result
				})
			}
			for (const item of this.attachmentItems) {
				verifyAttachmentDigest(item).then((result) => {
					if (result !== null) {
						this.$set(this.digestResults, item.key, result)
					}
				})
			}
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
		formatSize,
		openableMime,
		/**
		 * Format an ISO date(-time) per the user's Nextcloud locale.
		 * Non-date values are returned untouched.
		 *
		 * @param {string|null} value raw value from the document
		 * @return {string|null} localised date, e.g. "28. 2. 2008"
		 */
		formatDate(value) {
			if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) {
				return value
			}
			const date = new Date(value)
			if (Number.isNaN(date.getTime())) {
				return value
			}
			try {
				return new Intl.DateTimeFormat(getCanonicalLocale(),
					value.includes('T') ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' },
				).format(date)
			} catch (e) {
				return value
			}
		},
		paymentMeansLabel(code) {
			return PAYMENT_MEANS_LABELS[code] ?? code
		},
		checkLabel(key) {
			return CHECK_LABELS[key] ?? key
		},
		downloadAttachment(item) {
			// Always served as opaque bytes — never executed by the browser
			const url = URL.createObjectURL(new Blob([item.data], { type: 'application/octet-stream' }))
			const link = document.createElement('a')
			link.href = url
			link.download = item.displayName.split('/').pop()
			link.click()
			URL.revokeObjectURL(url)
		},
		openAttachment(item) {
			// Only types from the safe-list (images, PDF) can be opened
			const mime = openableMime(item.displayName)
			if (!mime) {
				return
			}
			const url = URL.createObjectURL(new Blob([item.data], { type: mime }))
			window.open(url, '_blank', 'noopener')
			setTimeout(() => URL.revokeObjectURL(url), 60000)
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

/* Validation banners above the paper, like the official ISDOC Reader */
.isdoc-banners {
	max-width: 950px;
	margin: 24px auto 0;
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.isdoc-banner {
	padding: 8px 16px;
	border-radius: 8px;
	font-size: 13px;
}

.isdoc-banner p {
	margin: 2px 0;
}

.isdoc-banner ul {
	margin: 2px 0 2px 24px;
	list-style: disc;
}

.isdoc-banner--ok {
	background-color: #e6f4e2;
	color: #1e5128;
}

.isdoc-banner--warn {
	background-color: #fdf3d7;
	color: #6e5200;
}

.isdoc-banner--info {
	background-color: #e3eef9;
	color: #15518f;
}

.isdoc-banner--error {
	background-color: #fae1e3;
	color: #842029;
}

.isdoc-banner details {
	margin: 4px 0 2px;
}

.isdoc-banner summary {
	cursor: pointer;
	font-weight: bold;
}

.isdoc-banner__details {
	width: auto;
	margin: 6px 0 6px 16px;
}

/* The invoice is rendered as a white "paper" sheet, like a PDF page */
.isdoc-paper {
	max-width: 950px;
	margin: 16px auto 32px;
	padding: 36px 44px;
	background-color: #fff;
	color: #333;
	border-radius: 8px;
	box-shadow: 0 2px 16px rgba(0, 0, 0, 0.18);
	font-size: 14px;
	line-height: 1.5;
}

.isdoc-titlebar {
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	gap: 16px;
	flex-wrap: wrap;
	border-bottom: 2px solid #15518f;
	padding-bottom: 8px;
	margin-bottom: 16px;
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
	gap: 10px;
	margin-bottom: 16px;
}

@media (max-width: 700px) {
	.isdoc-grid {
		grid-template-columns: 1fr;
	}
}

.isdoc-grid__col {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.isdoc-box {
	border: 1px solid #e4e7eb;
	border-radius: 8px;
	background-color: #fcfcfd;
	padding: 10px 14px;
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
	margin: 10px 0 4px 16px;
	font-size: 15px;
}

.isdoc-label {
	color: #5b7795;
	font-weight: bold;
	font-size: 11px;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	margin-bottom: 4px;
}

h3.isdoc-label {
	margin: 18px 0 4px;
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
	color: #666;
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
	text-align: right;
	white-space: nowrap;
	font-weight: 600;
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
	margin: 8px 0 16px;
}

.isdoc-lines th {
	border-bottom: 1px solid #d4dae1;
	padding: 6px 8px;
	text-align: left;
	font-weight: 600;
	font-size: 11px;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: #5b7795;
	white-space: nowrap;
}

.isdoc-lines td {
	padding: 6px 8px;
	vertical-align: top;
	border-bottom: 1px solid #f0f2f4;
}

.isdoc-lines tfoot td {
	border-top: 1px solid #d4dae1;
	border-bottom: none;
	padding: 6px 8px;
}

.isdoc-lines__subtotal td {
	color: #555;
}

.isdoc-lines__payable td {
	font-weight: bold;
	font-size: 15px;
	text-transform: uppercase;
	color: #15518f;
	background-color: #eef4fb;
}

.isdoc-lines__payable td:first-child {
	border-radius: 6px 0 0 6px;
}

.isdoc-lines__payable td:last-child {
	border-radius: 0 6px 6px 0;
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
	font-weight: 600;
	font-size: 11px;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: #5b7795;
	padding: 2px 12px;
	border-bottom: 1px solid #d4dae1;
	white-space: nowrap;
}

.isdoc-recap td {
	padding: 3px 12px;
}

.isdoc-bottom__totals {
	margin-left: auto;
}

.isdoc-muted {
	color: #888;
	font-size: 12px;
	margin: 12px 0 0;
}

/* Inline control-sum marks next to validated amounts */
.isdoc-mark {
	margin-left: 4px;
	font-weight: bold;
	cursor: help;
}

.isdoc-mark--ok {
	color: #2e7d32;
}

.isdoc-mark--warn {
	color: #c77700;
}

/* Attachment list (inside the info banner) */
.isdoc-attachments {
	list-style: none;
	margin: 6px 0 2px;
	padding: 0;
}

.isdoc-attachments li {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-wrap: wrap;
	padding: 4px 0;
}

.isdoc-attachments li + li {
	border-top: 1px solid rgba(21, 81, 143, 0.12);
}

.isdoc-attachments__name {
	font-weight: 600;
}

.isdoc-attachments__size {
	color: #5b7795;
	font-size: 12px;
}

.isdoc-attachments__badge {
	background-color: rgba(21, 81, 143, 0.12);
	color: #15518f;
	border-radius: 10px;
	padding: 0 8px;
	font-size: 12px;
}

.isdoc-attachments__action {
	font-size: 12px;
	padding: 1px 12px;
	border: 1px solid #b9cad9;
	border-radius: 6px;
	background-color: #fff;
	color: #15518f;
	cursor: pointer;
}

.isdoc-attachments__action:hover {
	background-color: #f0f5fa;
}
</style>
