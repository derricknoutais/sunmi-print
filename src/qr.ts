import qrcode from 'qrcode-generator';

/**
 * La matrice d'un QR code : `true` pour un module noir.
 *
 * Le générateur code chaque caractère sur UN octet (son code & 0xFF) : un
 * « é » y deviendrait un octet Latin-1 que les lecteurs décodent mal. On lui
 * passe donc la suite des octets UTF-8, un caractère par octet — sans toucher
 * à sa configuration globale, que la page peut partager avec d'autres usages.
 */
export function matriceQr(donnees: string, correction: 'L' | 'M' | 'Q' | 'H' = 'M'): boolean[][] {
    const qr = qrcode(0, correction);
    qr.addData(enOctetsUtf8(donnees), 'Byte');
    qr.make();

    const n = qr.getModuleCount();
    const matrice: boolean[][] = [];
    for (let ligne = 0; ligne < n; ligne++) {
        const rangee: boolean[] = [];
        for (let colonne = 0; colonne < n; colonne++) rangee.push(qr.isDark(ligne, colonne));
        matrice.push(rangee);
    }
    return matrice;
}

function enOctetsUtf8(texte: string): string {
    const octets = new TextEncoder().encode(texte);
    let resultat = '';
    for (let i = 0; i < octets.length; i++) resultat += String.fromCharCode(octets[i]);
    return resultat;
}
