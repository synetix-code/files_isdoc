/**
 * SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Creates tests/fixtures/signed-sample.isdoc: a minimal ISDOC invoice with
 * an enveloped XML-DSig signature made with a throwaway self-signed
 * certificate. Used to test the signature verification code path.
 *
 * Run from the app root: node tests/make-signed-fixture.mjs
 */

import fs from 'node:fs'
import { JSDOM } from 'jsdom'

const { DOMParser, XMLSerializer } = new JSDOM('').window
globalThis.DOMParser = DOMParser
globalThis.XMLSerializer = XMLSerializer

const pkijs = await import('pkijs')
const asn1js = await import('asn1js')
const xmldsig = await import('xmldsigjs')

const crypto = globalThis.crypto
pkijs.setEngine('node', new pkijs.CryptoEngine({ crypto, subtle: crypto.subtle }))
xmldsig.Application.setEngine('NodeWebCrypto', crypto)

const INVOICE = `<?xml version="1.0" encoding="utf-8"?>
<Invoice xmlns="http://isdoc.cz/namespace/2013" version="6.0.2">
  <DocumentType>1</DocumentType>
  <ID>TEST-2026-001</ID>
  <UUID>00000000-0000-0000-0000-000000000001</UUID>
  <IssueDate>2026-06-12</IssueDate>
  <TaxPointDate>2026-06-12</TaxPointDate>
  <VATApplicable>true</VATApplicable>
  <LocalCurrencyCode>CZK</LocalCurrencyCode>
  <CurrRate>1</CurrRate>
  <RefCurrRate>1</RefCurrRate>
  <AccountingSupplierParty><Party>
    <PartyIdentification><ID>12345678</ID></PartyIdentification>
    <PartyName><Name>Testovací dodavatel s.r.o.</Name></PartyName>
    <PostalAddress><StreetName>Ulice</StreetName><BuildingNumber>1</BuildingNumber>
      <CityName>Brno</CityName><PostalZone>60200</PostalZone>
      <Country><IdentificationCode>CZ</IdentificationCode><Name>Česká republika</Name></Country>
    </PostalAddress>
    <PartyTaxScheme><CompanyID>CZ12345678</CompanyID><TaxScheme>VAT</TaxScheme></PartyTaxScheme>
  </Party></AccountingSupplierParty>
  <AccountingCustomerParty><Party>
    <PartyIdentification><ID>87654321</ID></PartyIdentification>
    <PartyName><Name>Testovací odběratel a.s.</Name></PartyName>
    <PostalAddress><StreetName>Náměstí</StreetName><BuildingNumber>2</BuildingNumber>
      <CityName>Praha</CityName><PostalZone>11000</PostalZone>
      <Country><IdentificationCode>CZ</IdentificationCode><Name>Česká republika</Name></Country>
    </PostalAddress>
  </Party></AccountingCustomerParty>
  <InvoiceLines>
    <InvoiceLine>
      <ID>1</ID>
      <InvoicedQuantity unitCode="ks">2</InvoicedQuantity>
      <LineExtensionAmount>2000.00</LineExtensionAmount>
      <LineExtensionAmountTaxInclusive>2420.00</LineExtensionAmountTaxInclusive>
      <LineExtensionTaxAmount>420.00</LineExtensionTaxAmount>
      <UnitPrice>1000.00</UnitPrice>
      <UnitPriceTaxInclusive>1210.00</UnitPriceTaxInclusive>
      <ClassifiedTaxCategory><Percent>21</Percent>
        <VATCalculationMethod>0</VATCalculationMethod><VATApplicable>true</VATApplicable>
      </ClassifiedTaxCategory>
      <Item><Description>Testovací položka</Description></Item>
    </InvoiceLine>
  </InvoiceLines>
  <TaxTotal>
    <TaxSubTotal>
      <TaxableAmount>2000.00</TaxableAmount>
      <TaxAmount>420.00</TaxAmount>
      <TaxInclusiveAmount>2420.00</TaxInclusiveAmount>
      <AlreadyClaimedTaxableAmount>0</AlreadyClaimedTaxableAmount>
      <AlreadyClaimedTaxAmount>0</AlreadyClaimedTaxAmount>
      <AlreadyClaimedTaxInclusiveAmount>0</AlreadyClaimedTaxInclusiveAmount>
      <DifferenceTaxableAmount>2000.00</DifferenceTaxableAmount>
      <DifferenceTaxAmount>420.00</DifferenceTaxAmount>
      <DifferenceTaxInclusiveAmount>2420.00</DifferenceTaxInclusiveAmount>
      <TaxCategory><Percent>21</Percent></TaxCategory>
    </TaxSubTotal>
    <TaxAmount>420.00</TaxAmount>
  </TaxTotal>
  <LegalMonetaryTotal>
    <TaxExclusiveAmount>2000.00</TaxExclusiveAmount>
    <TaxInclusiveAmount>2420.00</TaxInclusiveAmount>
    <AlreadyClaimedTaxExclusiveAmount>0</AlreadyClaimedTaxExclusiveAmount>
    <AlreadyClaimedTaxInclusiveAmount>0</AlreadyClaimedTaxInclusiveAmount>
    <DifferenceTaxExclusiveAmount>2000.00</DifferenceTaxExclusiveAmount>
    <DifferenceTaxInclusiveAmount>2420.00</DifferenceTaxInclusiveAmount>
    <PaidDepositsAmount>0</PaidDepositsAmount>
    <PayableAmount>2420.00</PayableAmount>
  </LegalMonetaryTotal>
  <PaymentMeans><Payment>
    <PaidAmount>2420.00</PaidAmount>
    <PaymentMeansCode>42</PaymentMeansCode>
    <Details>
      <PaymentDueDate>2026-06-26</PaymentDueDate>
      <ID>1234567890</ID>
      <BankCode>0800</BankCode>
      <Name>Testovací banka</Name>
      <IBAN>CZ6508000000001234567890</IBAN>
      <BIC>GIBACZPX</BIC>
      <VariableSymbol>2026001</VariableSymbol>
    </Details>
  </Payment></PaymentMeans>
</Invoice>`

// --- Self-signed certificate -------------------------------------------

const algorithm = {
	name: 'RSASSA-PKCS1-v1_5',
	hash: 'SHA-256',
	publicExponent: new Uint8Array([1, 0, 1]),
	modulusLength: 2048,
}
const keys = await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify'])

const cert = new pkijs.Certificate()
cert.version = 2
cert.serialNumber = new asn1js.Integer({ value: 20260001 })
for (const name of [cert.issuer, cert.subject]) {
	name.typesAndValues.push(new pkijs.AttributeTypeAndValue({
		type: '2.5.4.3', // CN
		value: new asn1js.Utf8String({ value: 'Testovací podpis files_isdoc' }),
	}))
	name.typesAndValues.push(new pkijs.AttributeTypeAndValue({
		type: '2.5.4.10', // O
		value: new asn1js.Utf8String({ value: 'Synetix test' }),
	}))
}
cert.notBefore.value = new Date('2026-01-01T00:00:00Z')
cert.notAfter.value = new Date('2036-01-01T00:00:00Z')
await cert.subjectPublicKeyInfo.importKey(keys.publicKey)
await cert.sign(keys.privateKey, 'SHA-256')
const certB64 = Buffer.from(cert.toSchema(true).toBER(false)).toString('base64')

// --- Sign the invoice (enveloped XML-DSig) -----------------------------

const doc = xmldsig.Parse(INVOICE)
const signedXml = new xmldsig.SignedXml()
const signature = await signedXml.Sign(
	{ name: 'RSASSA-PKCS1-v1_5' },
	keys.privateKey,
	doc,
	{
		references: [{ hash: 'SHA-256', transforms: ['enveloped', 'c14n'], uri: '' }],
		x509: [certB64],
	},
)

doc.documentElement.appendChild(doc.importNode(signature.GetXml(), true))
const output = new XMLSerializer().serializeToString(doc)
fs.writeFileSync(new URL('./fixtures/signed-sample.isdoc', import.meta.url), output)
console.log('signed-sample.isdoc written,', output.length, 'bytes')
