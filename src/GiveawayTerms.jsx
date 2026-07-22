import { Link } from 'react-router-dom'

// Brand palette (matches App.jsx)
const T  = '#C4623A'   // terracotta
const TL = '#F5EDE7'   // terracotta light
const BG = '#FDF6E8'   // sand light / page bg
const INK = '#3A2A20'  // body text
const MUTE = '#7A6A5E' // muted text
const GOLD = '#C9A96E'

const wrap = { minHeight:'100vh', background:BG, color:INK, fontFamily:"'Montserrat',system-ui,sans-serif", padding:'0 0 80px' }
const bar  = { background:T, color:'#fff', padding:'18px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }
const inner= { maxWidth:760, margin:'0 auto', padding:'32px 22px 0' }
const h1   = { fontFamily:"'Cormorant Garamond',Georgia,serif", fontWeight:600, fontSize:34, lineHeight:1.1, margin:'0 0 6px' }
const eyebrow = { color:T, fontWeight:600, letterSpacing:'0.22em', fontSize:12, textTransform:'uppercase', margin:'0 0 14px' }
const h2   = { fontFamily:"'Cormorant Garamond',Georgia,serif", fontWeight:600, fontSize:23, margin:'30px 0 8px', color:T }
const p    = { fontSize:14.5, lineHeight:1.65, margin:'0 0 12px', fontWeight:300 }
const li   = { fontSize:14.5, lineHeight:1.6, margin:'0 0 8px', fontWeight:300 }
const rule = { border:0, borderTop:`1px solid ${GOLD}`, opacity:0.5, margin:'26px 0' }
const tableWrap = { overflowX:'auto', margin:'6px 0 14px' }
const table = { width:'100%', borderCollapse:'collapse', fontSize:13.5 }
const th = { textAlign:'left', padding:'9px 12px', background:TL, color:INK, fontWeight:600, borderBottom:`1px solid ${GOLD}` }
const td = { padding:'9px 12px', borderBottom:`1px solid #ece1d2`, fontWeight:300 }
const note = { background:TL, borderLeft:`3px solid ${T}`, padding:'12px 14px', borderRadius:8, fontSize:13, color:MUTE, margin:'0 0 20px', fontWeight:300 }
const back = { color:'#fff', textDecoration:'none', fontSize:13, fontWeight:600, letterSpacing:'0.03em' }

function S({ n, title, children }) {
  return (
    <section>
      <h2 style={h2}>{n}. {title}</h2>
      {children}
    </section>
  )
}

export default function GiveawayTerms() {
  return (
    <div style={wrap}>
      <div style={bar}>
        <span style={{ fontWeight:700, letterSpacing:'0.18em', fontSize:14 }}>HOSPOSEARCH</span>
        <Link to="/" style={back}>← Back to site</Link>
      </div>

      <div style={inner}>
        <p style={eyebrow}>Giveaway</p>
        <h1 style={h1}>Sign-Up Giveaway — Terms &amp; Conditions</h1>
        <p style={{ ...p, color:MUTE, marginBottom:24 }}>
          Promoter: HospoSearch (ABN 46 820 962 502), Gold Coast, QLD,
          Australia · tim@hosposearch.com
        </p>

        <S n="1" title="Agreement to terms">
          <p style={p}>Entry into this promotion constitutes acceptance of these Terms &amp; Conditions. These terms form part of the entry conditions and cannot be varied once the promotion has commenced.</p>
        </S>

        <S n="2" title="Promotional period">
          <p style={p}>The promotion opens on the date these terms are published and closes at <strong>11:59pm AEST, 31 August 2026</strong> (the “Promotional Period”). Entries received outside the Promotional Period will not be accepted.</p>
        </S>

        <S n="3" title="Eligibility">
          <p style={p}>3.1 Entry is open only to residents of Australia and New Zealand aged 18 years or over at the time of entry.</p>
          <p style={p}>3.2 To claim a prize, a winner must provide a valid residential postal address within Australia or New Zealand to which the prize can be posted. A winner who cannot provide a valid AU or NZ postal address is ineligible to receive a prize.</p>
          <p style={p}>3.3 Employees (and their immediate families) of the Promoter, and any agency or company associated with this promotion, are ineligible to enter.</p>
          <p style={p}>3.4 Where an entrant registers as an employer, the entrant must be authorised to act on behalf of that business.</p>
        </S>

        <S n="4" title="How to enter">
          <p style={p}>4.1 To enter, a person must, during the Promotional Period, (a) register a free account at hosposearch.com.au (or hosposearch.co.nz) as either a candidate or an employer; and (b) complete their profile.</p>
          <p style={p}>4.2 <strong>Entry is free.</strong> No purchase is necessary and no payment of any kind is required to enter or to win — including the employer draw. Creating a free employer account during the Promotional Period is sufficient to enter Draw C; purchasing a listing is not required and does not increase an entrant’s chance of winning.</p>
          <p style={p}>4.3 One entry per person. Duplicate, incomplete, automated or fraudulent registrations will be disqualified.</p>
        </S>

        <S n="5" title="Prizes">
          <p style={p}>5.1 There are three (3) prizes available:</p>
          <div style={tableWrap}>
            <table style={table}>
              <thead><tr><th style={th}>Draw</th><th style={th}>Entrant type</th><th style={th}>Prize</th></tr></thead>
              <tbody>
                <tr><td style={td}>A</td><td style={td}>Candidate registrations</td><td style={td}>1 × AUD $100 prize card</td></tr>
                <tr><td style={td}>B</td><td style={td}>Candidate registrations</td><td style={td}>1 × AUD $100 prize card</td></tr>
                <tr><td style={td}>C</td><td style={td}>Employer registrations</td><td style={td}>1 × AUD $100 prize card</td></tr>
              </tbody>
            </table>
          </div>
          <p style={p}>5.2 Total prize pool: <strong>AUD $300</strong>.</p>
          <p style={p}>5.3 Each prize is a AUD $100 card, awarded by the winner’s country of residence: Australian winners receive a AUD $100 Good Food Restaurant Gift Card; New Zealand winners receive a NZD-equivalent $100 Prezzy Card (prepaid Visa).</p>
          <p style={p}>5.4 Prizes are not transferable, not exchangeable and not redeemable for cash. Any element of a prize not taken as offered is forfeited. The Promoter is not responsible for the goods or services obtained with a prize card, or for any card issuer’s or venue’s terms, availability or failure to honour a card.</p>
        </S>

        <S n="6" title="Draw">
          <p style={p}>6.1 The winners will be determined by random electronic draw conducted at the Promoter’s premises in Gold Coast, Queensland, within seven (7) days after the close of the Promotional Period.</p>
          <p style={p}>6.2 Each valid entry has an equal chance of winning within its respective draw. Candidate entries are eligible for Draws A–B; employer entries are eligible for Draw C. A single entrant cannot win more than one prize.</p>
          <p style={p}>6.3 The draw is a game of chance. Skill plays no part in determining winners.</p>
        </S>

        <S n="7" title="Notification, claim and delivery">
          <p style={p}>7.1 Winners will be notified in writing by email to the address supplied at registration within seven (7) days of the draw.</p>
          <p style={p}>7.2 To claim, a winner must provide a valid AU or NZ postal address within seven (7) days of notification. Prizes will be posted to the address provided. The Promoter is not liable for prizes lost or delayed in the post once correctly addressed and sent.</p>
          <p style={p}>7.3 Winners’ first names and general locality (e.g. “Sam, Brisbane”) will be published on hosposearch.com.au and/or @hosposearch on Instagram within 14 days of the draw.</p>
          <p style={p}>7.4 If a winner cannot be contacted, does not provide a valid postal address, or does not claim their prize within twenty-eight (28) days of the draw, the prize will be forfeited and an unclaimed prize draw will be conducted on the same basis, with the redraw winner notified and published on the same terms.</p>
        </S>

        <S n="8" title="Privacy">
          <p style={p}>8.1 The Promoter collects personal information to conduct this promotion and operate the platform, handled per the Privacy Act 1988 (Cth) and, for NZ entrants, the Privacy Act 2020 (NZ), and the Promoter’s Privacy Policy.</p>
          <p style={p}>8.2 Entrants consent to the Promoter using their name and locality as described in clause 7.3.</p>
          <p style={p}>8.3 By registering, entrants may receive job alerts and communications from HospoSearch and may unsubscribe at any time. Consent to marketing is not a condition of entry.</p>
        </S>

        <S n="9" title="General">
          <p style={p}>9.1 The Promoter’s decision is final and no correspondence will be entered into.</p>
          <p style={p}>9.2 The Promoter is not liable for any lost, late, incomplete or misdirected entries, or any technical failure preventing entry.</p>
          <p style={p}>9.3 If for any reason this promotion cannot run as planned, the Promoter reserves the right, subject to applicable law, to cancel, terminate, modify or suspend the promotion.</p>
          <p style={p}>9.4 Nothing in these terms limits any consumer guarantee under the Competition and Consumer Act 2010 (Cth) or the Consumer Guarantees Act 1993 (NZ). Subject to that, the Promoter excludes all liability for any loss or damage arising from participation or acceptance or use of a prize.</p>
          <p style={p}>9.5 This promotion is in no way sponsored, endorsed, administered by or associated with Instagram, Meta Platforms, Inc., Facebook, LinkedIn or TikTok. Entrants release these platforms completely.</p>
          <p style={p}>9.6 Winners are responsible for any tax implications and should seek independent advice.</p>
          <p style={p}>9.7 This promotion is governed by the laws of Queensland, Australia.</p>
          <p style={p}>9.8 No permit is required in any Australian state or territory, as the total prize pool (AUD $300) does not exceed the relevant thresholds. Entry is free in all jurisdictions. In New Zealand, entry is free and no licence is required for a sales promotion scheme.</p>
        </S>

        <hr style={rule} />
        <p style={{ ...p, color:MUTE, fontSize:13 }}>© {new Date().getFullYear()} HospoSearch · FIND. GROW. STAY.</p>
      </div>
    </div>
  )
}
