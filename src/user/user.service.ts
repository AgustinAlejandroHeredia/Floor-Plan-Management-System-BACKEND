import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthService, AuthUser } from 'src/auth/auth.service';

// MONGOOSE
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from 'src/schemas/user.schema';
import { Model } from 'mongoose';

@Injectable()
export class UserService {

  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private readonly authService: AuthService,
  ){}

  create(createUserDto: CreateUserDto) {
    return 'This action adds a new user';
  }

  findAll() {
    return `This action returns all user`;
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }

  async getOrCreateUser(token: string): Promise<User> {

    const authUser = await this.authService.getUserInfo(token);

    const user = await this.userModel.findOneAndUpdate(
      { auth0Id: authUser.id }, // filtro
      {
        $setOnInsert: {
          auth0Id: authUser.id,
          email: authUser.email,
          name: authUser.name,
          picture: authUser.picture,
        },
      },
      {
        new: true,      // devuelve el doc actualizado/creado
        upsert: true,   // crea si no existe
      }
    );

    return user;
  }

}
