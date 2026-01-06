// Tunisian governorates and major cities
export const TUNISIA_LOCATIONS = [
  { governorate: 'Tunis', cities: ['Tunis', 'Le Bardo', 'La Marsa', 'Carthage', 'Sidi Bou Saïd', 'Le Kram'] },
  { governorate: 'Ariana', cities: ['Ariana', 'La Soukra', 'Raoued', 'Kalâat el-Andalous', 'Sidi Thabet', 'Mnihla'] },
  { governorate: 'Ben Arous', cities: ['Ben Arous', 'Radès', 'Hammam Lif', 'Hammam Chott', 'Ezzahra', 'Mégrine', 'Mohamedia', 'Fouchana'] },
  { governorate: 'Manouba', cities: ['Manouba', 'Den Den', 'Douar Hicher', 'Oued Ellil', 'Tebourba', 'El Battan'] },
  { governorate: 'Nabeul', cities: ['Nabeul', 'Hammamet', 'Kélibia', 'Korba', 'Menzel Temime', 'Soliman', 'Grombalia', 'Dar Chaâbane'] },
  { governorate: 'Zaghouan', cities: ['Zaghouan', 'El Fahs', 'Nadhour', 'Bir Mcherga', 'Zriba'] },
  { governorate: 'Bizerte', cities: ['Bizerte', 'Menzel Bourguiba', 'Mateur', 'Ras Jebel', 'Menzel Jemil', 'Tinja', 'Sejnane'] },
  { governorate: 'Béja', cities: ['Béja', 'Medjez el-Bab', 'Testour', 'Nefza', 'Téboursouk', 'Goubellat'] },
  { governorate: 'Jendouba', cities: ['Jendouba', 'Tabarka', 'Aïn Draham', 'Bou Salem', 'Ghardimaou', 'Fernana'] },
  { governorate: 'Le Kef', cities: ['Le Kef', 'Dahmani', 'Tajerouine', 'Sakiet Sidi Youssef', 'Nebeur', 'Kalaat Senan'] },
  { governorate: 'Siliana', cities: ['Siliana', 'Bou Arada', 'Gaâfour', 'El Krib', 'Makthar', 'Rouhia'] },
  { governorate: 'Sousse', cities: ['Sousse', 'Msaken', 'Kalaa Kebira', 'Hammam Sousse', 'Akouda', 'Kalaa Sghira', 'Enfidha'] },
  { governorate: 'Monastir', cities: ['Monastir', 'Moknine', 'Jemmal', 'Ksar Hellal', 'Téboulba', 'Sahline', 'Bembla', 'Sayada'] },
  { governorate: 'Mahdia', cities: ['Mahdia', 'Ksour Essef', 'El Jem', 'Chebba', 'Bou Merdes', 'Melloulech'] },
  { governorate: 'Sfax', cities: ['Sfax', 'Sakiet Ezzit', 'Sakiet Eddaïer', 'El Ain', 'Thyna', 'Agareb', 'Jbeniana', 'Mahares', 'Kerkennah'] },
  { governorate: 'Kairouan', cities: ['Kairouan', 'Sbikha', 'Haffouz', 'Nasrallah', 'Hajeb El Ayoun', 'Chebika', 'Oueslatia'] },
  { governorate: 'Kasserine', cities: ['Kasserine', 'Sbeitla', 'Thala', 'Foussana', 'Fériana', 'Haïdra', 'Sbiba'] },
  { governorate: 'Sidi Bouzid', cities: ['Sidi Bouzid', 'Regueb', 'Jilma', 'Menzel Bouzaiane', 'Meknassy', 'Bir El Hafey'] },
  { governorate: 'Gabès', cities: ['Gabès', 'El Hamma', 'Mareth', 'Métouia', 'Ghannouch', 'Nouvelle Matmata', 'Matmata'] },
  { governorate: 'Médenine', cities: ['Médenine', 'Zarzis', 'Ben Gardane', 'Houmt Souk (Djerba)', 'Midoun', 'Ajim', 'Beni Khedache'] },
  { governorate: 'Tataouine', cities: ['Tataouine', 'Ghomrassen', 'Remada', 'Dehiba', 'Bir Lahmar', 'Smar'] },
  { governorate: 'Gafsa', cities: ['Gafsa', 'Métlaoui', 'Redeyef', 'El Guettar', 'Mdhilla', 'Sned', 'Belkhir'] },
  { governorate: 'Tozeur', cities: ['Tozeur', 'Nefta', 'Degache', 'Tameghza', 'Hazoua'] },
  { governorate: 'Kébili', cities: ['Kébili', 'Douz', 'Souk Lahad', 'El Golâa', 'Jemna', 'Faouar'] },
] as const;

export type TunisiaGovernorate = typeof TUNISIA_LOCATIONS[number]['governorate'];
