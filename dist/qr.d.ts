/**
 * La matrice d'un QR code : `true` pour un module noir.
 *
 * Le générateur code chaque caractère sur UN octet (son code & 0xFF) : un
 * « é » y deviendrait un octet Latin-1 que les lecteurs décodent mal. On lui
 * passe donc la suite des octets UTF-8, un caractère par octet — sans toucher
 * à sa configuration globale, que la page peut partager avec d'autres usages.
 */
export declare function matriceQr(donnees: string, correction?: 'L' | 'M' | 'Q' | 'H'): boolean[][];
