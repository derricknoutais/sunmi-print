/**
 * Coupe un texte en lignes qui tiennent dans `largeurMax`.
 *
 * Les mots vont à la ligne entiers ; un mot plus long que la ligne — une
 * référence, une URL — est coupé où il déborde, plutôt que de sortir du
 * papier. Les espaces de tête d'un paragraphe sont gardés (« ␣␣2 × 500 »
 * reste en retrait), mais une ligne de continuation ne commence jamais par
 * une espace.
 */
export function couperEnLignes(texte, largeurMax, mesurer) {
    const lignes = [];
    for (const paragraphe of texte.replace(/\r\n?/g, '\n').replace(/\t/g, ' ').split('\n')) {
        if (paragraphe.trim() === '') {
            lignes.push('');
            continue;
        }
        const siennes = [];
        let courante = null;
        // Une suite d'espaces donne des mots vides : ils conservent l'espacement.
        for (const mot of paragraphe.split(' ')) {
            if (courante === null && mot === '' && siennes.length > 0)
                continue;
            const candidate = courante === null ? mot : `${courante} ${mot}`;
            if (mesurer(candidate) <= largeurMax) {
                courante = candidate;
                continue;
            }
            if (courante !== null && courante.trim() !== '')
                siennes.push(courante.replace(/ +$/, ''));
            courante = null;
            if (mot === '')
                continue;
            if (mesurer(mot) <= largeurMax) {
                courante = mot;
            }
            else {
                const morceaux = couperLeMot(mot, largeurMax, mesurer);
                siennes.push(...morceaux.slice(0, -1));
                courante = morceaux[morceaux.length - 1];
            }
        }
        if (courante !== null && courante.trim() !== '')
            siennes.push(courante.replace(/ +$/, ''));
        lignes.push(...siennes);
    }
    return lignes;
}
/** Après ces signes, une référence ou une URL se coupe sans se défigurer. */
const COUPURES = '-/_.,:;?&=';
/**
 * Coupe un mot trop long en morceaux qui tiennent chacun sur une ligne — après
 * un tiret ou une barre oblique quand il y en a un (« ADK- / 5904 » plutôt
 * que « ADK-5 / 904 »), n'importe où sinon.
 */
function couperLeMot(mot, largeurMax, mesurer) {
    const morceaux = [];
    // Array.from découpe par caractère réel, sans séparer une paire de substitution.
    let courant = [];
    for (const caractere of Array.from(mot)) {
        if (courant.length > 0 && mesurer(courant.join('') + caractere) > largeurMax) {
            let coupure = courant.length - 1;
            while (coupure >= 0 && COUPURES.indexOf(courant[coupure]) === -1)
                coupure--;
            const reste = courant.slice(coupure + 1);
            // Couper au signe seulement si ce qui passe à la ligne y tient.
            if (coupure >= 0 && mesurer(reste.join('') + caractere) <= largeurMax) {
                morceaux.push(courant.slice(0, coupure + 1).join(''));
                courant = reste;
            }
            else {
                morceaux.push(courant.join(''));
                courant = [];
            }
        }
        courant.push(caractere);
    }
    morceaux.push(courant.join(''));
    return morceaux;
}
