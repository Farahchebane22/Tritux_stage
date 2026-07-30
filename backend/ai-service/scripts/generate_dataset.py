"""
Génère un dataset réaliste de tickets IT (FR) pour Tritux Helpdesk.
Categories: hardware, software, network, account, email, security, other
Priorities: low, medium, high, urgent
"""
from __future__ import annotations

import csv
import random
from pathlib import Path

random.seed(42)

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)
OUT = RAW_DIR / "tickets_dataset.csv"

# Templates: (title, description, category, priority, resolution_hint)
TEMPLATES: list[tuple[str, str, str, str, str]] = [
    # --- NETWORK ---
    ("Impossible de se connecter au VPN", "Erreur 'connexion VPN échouée' depuis le télétravail. Client OpenVPN à jour.", "network", "high", "Vérifier certificat VPN, DNS et firewall."),
    ("VPN se déconnecte toutes les 10 minutes", "La session VPN tombe régulièrement, surtout sur Wi-Fi public.", "network", "high", "Stabiliser la session: keepalive, MTU, éviter captive portal."),
    ("Pas d'accès Internet sur le poste", "Plus de navigation web ni ping 8.8.8.8 depuis ce matin.", "network", "high", "Vérifier câble/Wi-Fi, DHCP, proxy Tritux."),
    ("Wi-Fi instable au 3ème étage", "Le réseau sans fil coupe souvent dans la salle réunion B.", "network", "medium", "Reset borne AP, vérifier couverture et canaux."),
    ("Impossible d'accéder au partage réseau", "\\\\tritux-fs01\\projets inaccessible, erreur d'accès refusé.", "network", "medium", "Vérifier droits SMB et VPN si hors site."),
    ("Latence élevée sur Teams", "Appels Teams avec décalage audio important.", "network", "medium", "Tester bande passante, QoS, fermer VPN split tunnel."),
    ("DNS ne résout pas les sites internes", "intranet.tritux.local ne répond pas.", "network", "high", "Pointer DNS vers contrôleurs Tritux, flushdns."),
    ("Câble RJ45 défectueux poste finance", "Lien ethernet down, LED orange éteinte.", "network", "low", "Remplacer câble et tester port switch."),
    ("Proxy bloque certains sites pro", "Accès refusé via proxy pour un outil SaaS métier.", "network", "medium", "Demander exception proxy / whitelist."),
    ("Perte de connexion après veille", "Après sleep Windows, plus de réseau jusqu'au reboot.", "network", "medium", "Mettre à jour pilote NIC, désactiver energy saving."),
    # --- SECURITY ---
    ("Email de phishing suspect reçu", "Mail demandant de saisir mon mot de passe SSO via un lien externe.", "security", "urgent", "Ne pas cliquer, signaler phishing, reset MDP si cliqué."),
    ("Compte potentiellement compromis", "Connexions inhabituelles depuis l'étranger dans les logs.", "security", "urgent", "Révoquer sessions, reset MDP, MFA obligatoire."),
    ("Alerte antivirus malware détecté", "Windows Defender a mis en quarantaine un fichier.exe téléchargé.", "security", "urgent", "Ne pas restaurer, scanner complet, isoler poste."),
    ("Demande de droits admin local", "Besoin d'installer un outil, UAC bloque l'installation.", "security", "medium", "Évaluer besoin, déploiement via Intune si validé."),
    ("USB non autorisé bloqué", "Clé USB refusée par la politique de sécurité.", "security", "low", "Utiliser OneDrive Tritux, demander exception SI."),
    ("MFA ne fonctionne plus", "Codes Authenticator incorrects pour la connexion Office.", "security", "high", "Resynchroniser MFA / réenregistrer appareil."),
    ("Ransomware suspicion fichiers chiffrés", "Extensions .locked apparues sur mon dossier Documents.", "security", "urgent", "Débrancher réseau immédiatement, alerter SOC."),
    ("Lien suspect dans Teams", "Collègue a collé un lien raccourci douteux.", "security", "high", "Ne pas ouvrir, signaler au SOC Tritux."),
    ("Certificat SSL invalide sur portail", "Navigateur indique certificat non fiable.", "security", "high", "Vérifier horloge système et certificat serveur."),
    ("Demande d'audit des accès partage", "Besoin de revoir qui a accès au dossier RH.", "security", "medium", "Exporter ACL et valider avec Data Owner."),
    # --- SOFTWARE ---
    ("Outlook ne démarre plus", "Outlook plante au lancement avec erreur 0x8004010F.", "software", "high", "Réparer Office, mode sans échec, nouveau profil."),
    ("Excel plante à l'ouverture d'un fichier", "Fichier macro .xlsm provoque un crash Excel.", "software", "medium", "Ouvrir sans macro, réparer fichier, MAJ Office."),
    ("Teams ne rejoint pas les réunions", "Bouton Rejoindre grisé, erreur média.", "software", "medium", "Clear cache Teams, réinstaller client."),
    ("Word affiche document corrompu", "Impossible d'ouvrir mon rapport.docx.", "software", "medium", "Récupération Word / versions OneDrive."),
    ("Installation Docker Desktop bloquée", "Besoin Docker pour le projet, droits insuffisants.", "software", "medium", "Demande logiciel + validation sécurité."),
    ("VS Code extensions manquantes", "Environnement de dév incomplet après reset poste.", "software", "low", "Réinstaller pack extensions Tritux."),
    ("Adobe Reader ne s'ouvre pas", "PDF s'ouvre dans le navigateur uniquement.", "software", "low", "Réparer/réinstaller Acrobat Reader."),
    ("OneDrive synchronisation bloquée", "Icône rouge, fichiers hors ligne non sync.", "software", "medium", "Reset OneDrive, espace disque, droits."),
    ("PowerPoint police manquante", "Présentation avec polices non installées.", "software", "low", "Installer polices corporate Tritux."),
    ("Navigateur Chrome très lent", "Onglets se figent, utilisation CPU élevée.", "software", "medium", "Désactiver extensions, clear cache."),
    ("Erreur licence Office 365", "Produit non licencié après changement de poste.", "software", "high", "Réactiver licence via compte Tritux."),
    ("Zoom / Teams conflit audio", "Micro non détecté pendant réunion.", "software", "medium", "Permissions Windows privacy + périphérique défaut."),
    # --- HARDWARE ---
    ("Écran secondaire scintille", "Moniteur HDMI scintille via dock USB-C.", "hardware", "low", "Tester câble, port, MAJ GPU."),
    ("Clavier certain touches mortes", "Touches E et R ne répondent plus.", "hardware", "low", "Nettoyage / remplacement clavier."),
    ("Souris sans fil se déconnecte", "Dongle Logitech instable.", "hardware", "low", "Changer piles, port USB, réappairage."),
    ("Batterie PC portable se décharge vite", "Autonomie < 1h alors que neuve il y a 2 ans.", "hardware", "medium", "Diagnostic batterie, remplacement si usée."),
    ("PC ne démarre plus", "Écran noir au power on, ventilateurs tournent.", "hardware", "high", "Tester RAM/écran externe, atelier."),
    ("Imprimante bureau n'imprime pas", "Travaux en file d'attente, status offline.", "hardware", "medium", "Redémarrer spooler, vérifier IP imprimante."),
    ("Webcam intégrée noire", "Caméra allumée mais image noire dans Teams.", "hardware", "medium", "Réinstaller pilote caméra, privacy settings."),
    ("Ventilateur très bruyant", "PC surchauffe et throttle en réunion.", "hardware", "medium", "Nettoyage poussière, paste thermique."),
    ("Dock USB-C non détecté", "Écrans externes ne s'allument plus via dock.", "hardware", "medium", "MAJ firmware dock, tester autre câble."),
    ("Casque audio crackle", "Bruits parasites sur casque USB.", "hardware", "low", "Changer port USB, pilote audio."),
    # --- ACCOUNT ---
    ("Mot de passe SSO expiré", "Impossible de se connecter, MDP expiré.", "account", "high", "Reset via self-service ou agent identité."),
    ("Compte verrouillé après tentatives", "Trop d'échecs de connexion, compte lock.", "account", "high", "Unlock Active Directory / Azure AD."),
    ("Demande de création compte prestataire", "Nouveau prestataire a besoin d'un accès mail.", "account", "medium", "Process onboarding RH + IT."),
    ("Droits accès SharePoint manquants", "Pas d'accès au site projet Alpha.", "account", "medium", "Ajouter au groupe Azure AD du site."),
    ("Changement de nom suite mariage", "Mettre à jour display name et email.", "account", "low", "Ticket identité + sync HRIS."),
    ("Désactivation compte collaborateur sorti", "Offboarding: désactiver compte demain 18h.", "account", "high", "Checklist offboarding AD/M365."),
    ("Accès VPN non provisionné", "Compte ok mais groupe VPN manquant.", "account", "high", "Ajouter au groupe VPN-Users."),
    ("Double authentification à configurer", "Onboarding: activer MFA obligatoire.", "account", "medium", "Guide enrollment Authenticator."),
    ("Alias email non reçu", "L'alias prenom.nom2 n'arrive pas.", "account", "medium", "Vérifier proxyAddresses Exchange."),
    ("Profil Windows corrompu", "Impossible de charger le profil local.", "account", "high", "Nouveau profil temporaire, migration data."),
    # --- EMAIL ---
    ("Mails n'arrivent plus en réception", "Boîte vide depuis hier, envoi OK.", "email", "high", "Règles Outlook, quarantaine, MX."),
    ("Pièces jointes bloquées", "PDF > 10 Mo refusés à l'envoi.", "email", "medium", "Utiliser OneDrive link, quota PJ."),
    ("Signature email à mettre à jour", "Nouvelle signature corporate manquante.", "email", "low", "Déployer signature centralisée."),
    ("Boîte partagée inaccessible", "support@tritux.com non visible.", "email", "medium", "Droits FullAccess mailbox."),
    ("Mails partent en spam chez clients", "Plaintes SPF/DKIM fail.", "email", "high", "Vérifier enregistrements DNS mail."),
    ("Calendrier Teams non synchronisé", "RDV Outlook absents de Teams.", "email", "medium", "Repair sync M365 calendar."),
    ("Quota boîte mail saturé", "Impossible de recevoir, 99 Go utilisés.", "email", "medium", "Archivage online + purge."),
    ("Règle de redirection suspecte", "Mails forward auto vers externe.", "email", "urgent", "Supprimer règle, reset MDP, audit."),
    ("Distribution list non à jour", "Liste all-staff contient anciens employés.", "email", "low", "Sync HR + nettoyage DL."),
    ("Erreur NDR 5.7.1", "Envoi interne refusé avec NDR.", "email", "medium", "Permissions send-as / connector."),
    # --- OTHER ---
    ("Demande formation Excel avancé", "Souhait formation tableaux croisés.", "other", "low", "Orienter catalogue formation Tritux."),
    ("Réservation salle réunion outil", "Comment réserver la salle Innovate?", "other", "low", "Utiliser Outlook room finder."),
    ("Demande inventaire matériel", "Liste des assets de mon département.", "other", "low", "Extraire depuis CMDB / Intune."),
    ("Question politique télétravail", "Jours autorisés hors site?", "other", "low", "Consulter RH / intranet."),
    ("Suggestion amélioration helpdesk", "Ajouter FAQ visible avant ticket.", "other", "low", "Remonter product owner."),
]

VARIANTS = [
    ("", ""),
    (" Merci de traiter rapidement.", " Impact sur mon activité quotidienne."),
    (" Urgent pour une livraison client.", " Deadline aujourd'hui 17h."),
    (" Problème reproduit sur 2 postes.", " Captures d'écran disponibles."),
    (" Depuis la dernière mise à jour Windows.", " Aucun changement matériel de mon côté."),
    (" En télétravail uniquement.", " Sur site le problème n'apparaît pas."),
]


def expand() -> list[dict]:
    rows: list[dict] = []
    tid = 1000
    for title, desc, cat, prio, hint in TEMPLATES:
        for suffix_t, suffix_d in VARIANTS:
            rows.append(
                {
                    "ticket_id": f"TRX-{tid}",
                    "title": (title + suffix_t).strip(),
                    "description": (desc + suffix_d).strip(),
                    "category": cat,
                    "priority": prio,
                    "resolution_hint": hint,
                    "language": "fr",
                    "source": "synthetic_tritux_v1",
                }
            )
            tid += 1
    # Extra paraphrases for balance
    extras = [
        ("Reset mot de passe oublié", "J'ai oublié mon mot de passe Windows et Office.", "account", "high", "Self-service reset SSO."),
        ("Imprimante imprime des pages blanches", "Toner semble OK mais sorties blanches.", "hardware", "low", "Tambour/toner, test page."),
        ("Connexion SSO lente", "Login Azure AD prend plus de 2 minutes.", "account", "medium", "Vérifier réseau et MFA latency."),
        ("Faux positif antivirus", "Logiciel métier bloqué à tort.", "security", "medium", "Whitelist contrôlée après analyse."),
        ("Câble réseau coupé open-space", "Poste voisin aussi offline.", "network", "medium", "Vérifier switch étage."),
        ("Erreur OneNote sync", "Bloc-notes ne se synchronise plus.", "software", "low", "Repair OneNote / Sign-out."),
        ("Demande accès GitLab", "Nouveau développeur sans accès dépôt.", "account", "medium", "Ajouter groupe gitlab-devs."),
        ("Alerte connexion RDP inhabituelle", "Tentative RDP hors heures.", "security", "urgent", "Bloquer IP, audit compte."),
        ("Écran bleu BSOD intermittent", "BSOD DRIVER_IRQL après dock.", "hardware", "high", "MAJ chipset/dock drivers."),
        ("Mailing list projet à créer", "Créer liste projet-nova@tritux.com.", "email", "low", "Créer DL Exchange."),
    ]
    for title, desc, cat, prio, hint in extras:
        for i in range(4):
            rows.append(
                {
                    "ticket_id": f"TRX-{tid}",
                    "title": title if i % 2 == 0 else title + " - besoin aide",
                    "description": desc + (f" Occurrence #{i+1}." if i else ""),
                    "category": cat,
                    "priority": prio,
                    "resolution_hint": hint,
                    "language": "fr",
                    "source": "synthetic_tritux_v1",
                }
            )
            tid += 1
    random.shuffle(rows)
    return rows


def main() -> None:
    rows = expand()
    with OUT.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "ticket_id",
                "title",
                "description",
                "category",
                "priority",
                "resolution_hint",
                "language",
                "source",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)
    cats = {}
    for r in rows:
        cats[r["category"]] = cats.get(r["category"], 0) + 1
    print(f"[OK] {len(rows)} tickets -> {OUT}")
    print("Répartition catégories:", cats)


if __name__ == "__main__":
    main()
