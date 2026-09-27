/**
 * La page de test : embarquée dans l'application Android (« Tester
 * l'imprimante »), ouvrable aussi dans un navigateur de bureau pour l'aperçu.
 * Compilée en un seul script classique par scripts/construire-demo.mjs : elle
 * doit tourner sans bundler, dans le WebView du V2 Pro — Chrome 62.
 */
import { apercuRecu, ErreurImpression, etatImprimante, imprimerRecu, mire, recuExemple, versionPont, type EtatImprimante, type Recu } from '../src/index.ts';

const element = (id: string): HTMLElement => {
    const trouve = document.getElementById(id);
    if (!trouve) throw new Error(`#${id} absent de la page`);
    return trouve;
};

let recuAffiche: Recu = recuExemple();

function journal(message: string, genre: 'ok' | 'erreur' | 'info' = 'info'): void {
    const li = document.createElement('li');
    li.className = genre;
    const heure = document.createElement('time');
    heure.textContent = new Date().toLocaleTimeString('fr-FR');
    li.appendChild(heure);
    li.appendChild(document.createTextNode(message));
    const liste = element('journal');
    liste.insertBefore(li, liste.firstChild);
}

const TRANSPORTS = {
    pont: () => `ouverte dans Sunmi Print (pont direct, protocole ${versionPont()})`,
    serveur: () => 'navigateur — service local de Sunmi Print',
    aucun: () => 'aucune — aperçu seulement',
};

let dernierEtat: EtatImprimante | null = null;

async function afficherEtat(): Promise<void> {
    const etat = await etatImprimante();
    dernierEtat = etat;
    element('pont').textContent = TRANSPORTS[etat.transport || 'aucun']();
    const libelle = element('etat');
    libelle.textContent = etat.message || etat.code;
    libelle.className = etat.code === 'prete' || etat.code === 'simulation' ? 'etat-prete' : 'etat-autre';
    element('largeur').textContent = `${etat.largeur} points (${etat.largeur >= 576 ? '80' : '58'} mm)${etat.modele ? ` — ${etat.modele}` : ''}`;
}

/** Un dégradé noir → blanc, pour juger la trame de l'imprimante. */
function degrade(): string {
    const toile = document.createElement('canvas');
    toile.width = 300;
    toile.height = 60;
    const ctx = toile.getContext('2d');
    if (!ctx) return '';
    const g = ctx.createLinearGradient(0, 0, 300, 0);
    g.addColorStop(0, '#000');
    g.addColorStop(1, '#fff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 300, 60);
    return toile.toDataURL('image/png');
}

async function montrer(recu: Recu): Promise<void> {
    recuAffiche = recu;
    try {
        const toile = (await apercuRecu(recu)) as HTMLCanvasElement;
        const cadre = element('apercu');
        while (cadre.firstChild) cadre.removeChild(cadre.firstChild);
        cadre.appendChild(toile);
    } catch (e) {
        journal(`Aperçu impossible : ${e instanceof Error ? e.message : String(e)}`, 'erreur');
    }
}

async function imprimer(): Promise<void> {
    const bouton = element('imprimer') as HTMLButtonElement;
    bouton.disabled = true;
    const debut = Date.now();
    try {
        const resultat = await imprimerRecu(recuAffiche);
        const duree = ((Date.now() - debut) / 1000).toFixed(1);
        journal(resultat.simulation ? `Simulation : reçu affiché par l'application (${duree} s).` : `Reçu imprimé (${duree} s).`, 'ok');
    } catch (e) {
        const code = e instanceof ErreurImpression ? `[${e.code}] ` : '';
        journal(`${code}${e instanceof Error ? e.message : String(e)}`, 'erreur');
    } finally {
        bouton.disabled = false;
        afficherEtat();
    }
}

element('voir-recu').addEventListener('click', () => montrer(recuExemple()));
element('voir-mire').addEventListener('click', () => montrer(mire({ image: degrade(), largeur: dernierEtat ? dernierEtat.largeur : 384 })));
element('actualiser').addEventListener('click', () => {
    afficherEtat().then(() => journal('État actualisé.'));
});
element('imprimer').addEventListener('click', imprimer);

montrer(recuAffiche);
afficherEtat().then(() => {
    const transport = dernierEtat && dernierEtat.transport;
    journal(
        transport === 'pont' ? 'Page ouverte dans Sunmi Print : impression par le pont direct.'
        : transport === 'serveur' ? 'Service local de Sunmi Print détecté.'
        : "Ni application ni service : l'impression est impossible ici, l'aperçu reste exact.",
    );
});
